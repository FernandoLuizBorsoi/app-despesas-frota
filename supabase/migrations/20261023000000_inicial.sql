-- Estrutura inicial do app de despesas da frota.
-- Motoristas lançam despesas com fotos do comprovante; gestores acompanham.

create extension if not exists "pgcrypto";

create table empresa (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  criado_em timestamptz not null default now()
);

create type perfil_usuario as enum ('motorista', 'gestor', 'admin');

-- Um registro por login do Supabase Auth.
create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references empresa (id),
  nome text not null,
  cpf text,
  telefone text,
  perfil perfil_usuario not null default 'motorista',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table veiculo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  placa text not null,
  modelo text,
  ano int,
  tipo_combustivel text,
  km_atual int not null default 0,
  ativo boolean not null default true,
  unique (empresa_id, placa)
);

create table categoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  nome text not null,
  exige_km boolean not null default false,
  exige_litros boolean not null default false,
  ordem int not null default 0,
  ativa boolean not null default true,
  unique (empresa_id, nome)
);

-- O id é gerado no celular, para o envio offline poder ser repetido sem duplicar.
create table despesa (
  id uuid primary key,
  empresa_id uuid not null references empresa (id),
  motorista_id uuid not null references usuario (id),
  veiculo_id uuid not null references veiculo (id),
  categoria_id uuid not null references categoria (id),
  data date not null,
  valor numeric(12, 2) not null check (valor > 0),
  km_odometro int check (km_odometro >= 0),
  litros numeric(10, 3) check (litros > 0),
  forma_pagamento text,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index despesa_empresa_data_idx on despesa (empresa_id, data desc);
create index despesa_motorista_idx on despesa (motorista_id, data desc);
create index despesa_veiculo_idx on despesa (veiculo_id, data desc);

create table comprovante (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references despesa (id) on delete cascade,
  ordem int not null default 0,
  caminho text not null, -- caminho no bucket "comprovantes"
  enviado_em timestamptz not null default now(),
  unique (despesa_id, ordem)
);

-- Funções auxiliares para as regras de acesso.
create function minha_empresa() returns uuid
  language sql stable security definer set search_path = public
  as $$ select empresa_id from usuario where id = auth.uid() and ativo $$;

create function sou_gestor() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (
    select 1 from usuario where id = auth.uid() and ativo and perfil in ('gestor', 'admin')
  ) $$;

-- Mantém o km atual do veículo com o maior odômetro lançado.
create function atualizar_km_veiculo() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if new.km_odometro is not null then
    update veiculo set km_atual = greatest(km_atual, new.km_odometro) where id = new.veiculo_id;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger despesa_km_veiculo
  before insert or update on despesa
  for each row execute function atualizar_km_veiculo();

-- Regras de acesso (RLS).
alter table empresa enable row level security;
alter table usuario enable row level security;
alter table veiculo enable row level security;
alter table categoria enable row level security;
alter table despesa enable row level security;
alter table comprovante enable row level security;

create policy empresa_leitura on empresa for select using (id = minha_empresa());

create policy usuario_leitura on usuario for select
  using (id = auth.uid() or (empresa_id = minha_empresa() and sou_gestor()));
create policy usuario_gestao on usuario for all
  using (empresa_id = minha_empresa() and sou_gestor())
  with check (empresa_id = minha_empresa() and sou_gestor());

create policy veiculo_leitura on veiculo for select using (empresa_id = minha_empresa());
create policy veiculo_gestao on veiculo for all
  using (empresa_id = minha_empresa() and sou_gestor())
  with check (empresa_id = minha_empresa() and sou_gestor());

create policy categoria_leitura on categoria for select using (empresa_id = minha_empresa());
create policy categoria_gestao on categoria for all
  using (empresa_id = minha_empresa() and sou_gestor())
  with check (empresa_id = minha_empresa() and sou_gestor());

-- Motorista vê e lança só as próprias despesas; gestor vê todas da empresa.
create policy despesa_leitura on despesa for select
  using (motorista_id = auth.uid() or (empresa_id = minha_empresa() and sou_gestor()));
create policy despesa_insercao on despesa for insert
  with check (motorista_id = auth.uid() and empresa_id = minha_empresa());
create policy despesa_edicao on despesa for update
  using (motorista_id = auth.uid() or (empresa_id = minha_empresa() and sou_gestor()))
  with check (empresa_id = minha_empresa());
create policy despesa_exclusao on despesa for delete
  using (empresa_id = minha_empresa() and sou_gestor());

create policy comprovante_leitura on comprovante for select
  using (exists (select 1 from despesa d where d.id = despesa_id));
create policy comprovante_insercao on comprovante for insert
  with check (exists (select 1 from despesa d where d.id = despesa_id and d.motorista_id = auth.uid()));
create policy comprovante_edicao on comprovante for update
  using (exists (select 1 from despesa d where d.id = despesa_id and d.motorista_id = auth.uid()));

-- Fotos ficam em comprovantes/<empresa_id>/<motorista_id>/<despesa_id>/<ordem>.jpg
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false)
  on conflict (id) do nothing;

create policy comprovante_foto_envio on storage.objects for insert
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = minha_empresa()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy comprovante_foto_substituicao on storage.objects for update
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = minha_empresa()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy comprovante_foto_leitura on storage.objects for select
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = minha_empresa()::text
    and ((storage.foldername(name))[2] = auth.uid()::text or sou_gestor())
  );

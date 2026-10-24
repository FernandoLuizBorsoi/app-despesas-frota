-- Manutenção preventiva (opcional, ligada pelo gestor em Configurações).
-- Cada item é um serviço de um veículo que se repete a cada X km e/ou a cada X meses.
alter table empresa add column if not exists manutencao_ativa boolean not null default false;

create table if not exists manutencao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresa (id),
  veiculo_id uuid not null references veiculo (id) on delete cascade,
  servico text not null,
  intervalo_km int check (intervalo_km > 0),
  intervalo_meses int check (intervalo_meses > 0),
  ultimo_km int not null default 0,
  ultima_data date not null default current_date,
  criado_em timestamptz not null default now(),
  check (intervalo_km is not null or intervalo_meses is not null)
);

alter table manutencao enable row level security;

drop policy if exists manutencao_gestao on manutencao;
create policy manutencao_gestao on manutencao for all
  using (empresa_id = minha_empresa() and sou_gestor())
  with check (empresa_id = minha_empresa() and sou_gestor());

select nome, manutencao_ativa from empresa;

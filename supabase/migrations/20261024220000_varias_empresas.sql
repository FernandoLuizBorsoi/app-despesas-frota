-- Várias empresas: o administrador geral (perfil admin) vê a lista de empresas, cria empresas novas
-- e "entra" em uma de cada vez (troca o próprio usuario.empresa_id). Assim todas as regras que usam
-- minha_empresa() continuam valendo sem mudança. Gestores seguem vendo só a própria empresa.

create or replace function sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuario where id = auth.uid() and ativo and perfil = 'admin')
$$;
revoke execute on function sou_admin() from public, anon;
grant execute on function sou_admin() to authenticated;

create policy empresa_admin_leitura on empresa for select using (sou_admin());

-- Protege os acessos: só o administrador mexe em quem é admin, e ninguém desativa a si mesmo.
-- Chamadas sem login (funções do servidor, SQL direto) passam.
create or replace function proteger_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if not sou_admin() and (
    (tg_op <> 'INSERT' and old.perfil = 'admin') or (tg_op <> 'DELETE' and new.perfil = 'admin')
  ) then
    raise exception 'Só o administrador geral pode alterar esse acesso.';
  end if;
  if tg_op = 'UPDATE' and old.ativo and not new.ativo and new.id = auth.uid() then
    raise exception 'Você não pode desativar o seu próprio acesso.';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function proteger_usuario() from public, anon, authenticated;

drop trigger if exists proteger_usuario on usuario;
create trigger proteger_usuario before insert or update or delete on usuario
  for each row execute function proteger_usuario();

-- O administrador entra em outra empresa.
create or replace function trocar_empresa(p_empresa uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_admin() then
    raise exception 'Só o administrador geral pode trocar de empresa.';
  end if;
  if not exists (select 1 from empresa where id = p_empresa) then
    raise exception 'Empresa não encontrada.';
  end if;
  update usuario set empresa_id = p_empresa where id = auth.uid();
end $$;
revoke execute on function trocar_empresa(uuid) from public, anon;
grant execute on function trocar_empresa(uuid) to authenticated;

-- Cria uma empresa já com as categorias padrão e devolve o id.
create or replace function criar_empresa(p_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nova uuid;
begin
  if not sou_admin() then
    raise exception 'Só o administrador geral pode criar empresas.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da empresa.';
  end if;
  insert into empresa (nome) values (trim(p_nome)) returning id into nova;
  insert into categoria (empresa_id, nome, exige_km, exige_litros, ordem) values
    (nova, 'Combustível', true, true, 1),
    (nova, 'Pedágio', false, false, 2),
    (nova, 'Manutenção', true, false, 3),
    (nova, 'Alimentação', false, false, 4),
    (nova, 'Hospedagem', false, false, 5),
    (nova, 'Estacionamento', false, false, 6),
    (nova, 'Lavagem', false, false, 7),
    (nova, 'Outros', false, false, 8);
  return nova;
end $$;
revoke execute on function criar_empresa(text) from public, anon;
grant execute on function criar_empresa(text) to authenticated;

-- Fernando é o administrador geral.
update usuario set perfil = 'admin' where id = '075e1ebd-37df-4fb0-9cd0-e249787fd1e6';

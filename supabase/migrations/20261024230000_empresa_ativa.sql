-- Empresa desativada pelo administrador geral: gestores e motoristas dela perdem o acesso
-- (minha_empresa() e sou_gestor() deixam de valer), mas nada é apagado.
alter table empresa add column if not exists ativa boolean not null default true;

create or replace function minha_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select u.empresa_id from usuario u join empresa e on e.id = u.empresa_id
  where u.id = auth.uid() and u.ativo and (e.ativa or u.perfil = 'admin')
$$;

create or replace function sou_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario u join empresa e on e.id = u.empresa_id
    where u.id = auth.uid() and u.ativo and u.perfil in ('gestor', 'admin') and (e.ativa or u.perfil = 'admin')
  )
$$;

drop policy if exists empresa_admin_gestao on empresa;
create policy empresa_admin_gestao on empresa for update using (sou_admin()) with check (sou_admin());

-- Só o administrador liga ou desliga uma empresa.
create or replace function proteger_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.ativa is distinct from old.ativa and not sou_admin() then
    raise exception 'Só o administrador geral pode desativar ou reativar a empresa.';
  end if;
  return new;
end $$;
revoke execute on function proteger_empresa() from public, anon, authenticated;

drop trigger if exists proteger_empresa on empresa;
create trigger proteger_empresa before update on empresa
  for each row execute function proteger_empresa();

select nome, ativa from empresa;

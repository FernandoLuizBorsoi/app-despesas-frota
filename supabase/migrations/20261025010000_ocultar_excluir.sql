-- O administrador geral pode ocultar (some da visão do gestor e do app) ou excluir de vez
-- motoristas e veículos. O bloqueio feito pelo gestor (ativo = false) continua mostrando o histórico.
alter table usuario add column if not exists oculto boolean not null default false;
alter table veiculo add column if not exists oculto boolean not null default false;

-- Pessoas: gestor não vê quem o administrador ocultou.
drop policy if exists usuario_leitura on usuario;
create policy usuario_leitura on usuario for select using (
  id = auth.uid() or (empresa_id = minha_empresa() and sou_gestor() and (not oculto or sou_admin()))
);
drop policy if exists usuario_gestao on usuario;
create policy usuario_gestao on usuario for all
  using (empresa_id = minha_empresa() and sou_gestor() and (not oculto or sou_admin()))
  with check (empresa_id = minha_empresa() and sou_gestor());

-- Veículos: nem gestor nem motorista veem os ocultos.
drop policy if exists veiculo_leitura on veiculo;
create policy veiculo_leitura on veiculo for select using (empresa_id = minha_empresa() and (not oculto or sou_admin()));
drop policy if exists veiculo_gestao on veiculo;
create policy veiculo_gestao on veiculo for all
  using (empresa_id = minha_empresa() and sou_gestor() and (not oculto or sou_admin()))
  with check (empresa_id = minha_empresa() and sou_gestor());

-- Despesas de motorista ou veículo oculto também somem para o gestor.
drop policy if exists despesa_leitura on despesa;
create policy despesa_leitura on despesa for select using (
  motorista_id = auth.uid()
  or (
    empresa_id = minha_empresa() and sou_gestor() and (
      sou_admin() or (
        not exists (select 1 from usuario u where u.id = despesa.motorista_id and u.oculto)
        and not exists (select 1 from veiculo v where v.id = despesa.veiculo_id and v.oculto)
      )
    )
  )
);

-- Só o administrador muda o "oculto".
create or replace function proteger_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if not sou_admin() and (
    (tg_op <> 'INSERT' and old.perfil = 'admin') or (tg_op <> 'DELETE' and new.perfil = 'admin')
    or (tg_op = 'UPDATE' and new.oculto is distinct from old.oculto)
    or (tg_op = 'INSERT' and new.oculto)
  ) then
    raise exception 'Só o administrador geral pode alterar esse acesso.';
  end if;
  if tg_op = 'UPDATE' and old.ativo and not new.ativo and new.id = auth.uid() then
    raise exception 'Você não pode desativar o seu próprio acesso.';
  end if;
  return coalesce(new, old);
end $$;

create or replace function proteger_veiculo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not sou_admin() and (
    (tg_op = 'UPDATE' and new.oculto is distinct from old.oculto) or (tg_op = 'INSERT' and new.oculto)
  ) then
    raise exception 'Só o administrador geral pode ocultar veículos.';
  end if;
  return new;
end $$;
revoke execute on function proteger_veiculo() from public, anon, authenticated;
drop trigger if exists proteger_veiculo on veiculo;
create trigger proteger_veiculo before insert or update on veiculo
  for each row execute function proteger_veiculo();

-- Exclusão definitiva (só administrador): apaga também as despesas e os comprovantes ligados.
create or replace function excluir_motorista(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_admin() then
    raise exception 'Só o administrador geral pode excluir.';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio acesso.';
  end if;
  update despesa set avaliado_por = null where avaliado_por = p_usuario;
  delete from despesa where motorista_id = p_usuario;
  delete from auth.users where id = p_usuario;
end $$;
revoke execute on function excluir_motorista(uuid) from public, anon;
grant execute on function excluir_motorista(uuid) to authenticated;

create or replace function excluir_veiculo(p_veiculo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not sou_admin() then
    raise exception 'Só o administrador geral pode excluir.';
  end if;
  delete from despesa where veiculo_id = p_veiculo;
  delete from veiculo where id = p_veiculo;
end $$;
revoke execute on function excluir_veiculo(uuid) from public, anon;
grant execute on function excluir_veiculo(uuid) to authenticated;

select 'pronto' as resultado;

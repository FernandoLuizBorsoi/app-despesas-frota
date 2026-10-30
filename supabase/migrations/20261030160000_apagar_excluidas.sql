-- O motorista toca em "Entendi" no aviso de despesa excluída pelo gestor: ela sai do banco de vez
-- (pedido do Fernando em 2026-10-30). Só apaga as do próprio motorista que estão como excluídas.
create or replace function apagar_excluidas(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from despesa
  where id = any(p_ids) and motorista_id = auth.uid() and situacao = 'excluida';
end $$;
revoke execute on function apagar_excluidas(uuid[]) from public, anon;
grant execute on function apagar_excluidas(uuid[]) to authenticated;

select 'pronto' as resultado;

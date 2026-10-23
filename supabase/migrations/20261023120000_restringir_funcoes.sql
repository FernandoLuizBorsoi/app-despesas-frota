-- As funções de apoio das regras de acesso só fazem sentido para quem está logado,
-- e a do gatilho de km não deve ser chamada diretamente por ninguém.
revoke execute on function public.minha_empresa() from public, anon;
revoke execute on function public.sou_gestor() from public, anon;
grant execute on function public.minha_empresa() to authenticated;
grant execute on function public.sou_gestor() to authenticated;
revoke execute on function public.atualizar_km_veiculo() from public, anon, authenticated;

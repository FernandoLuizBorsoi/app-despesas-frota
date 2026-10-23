-- E-mail ao gestor quando chega despesa nova ou corrigida (função avisar-gestor).
create extension if not exists pg_net with schema extensions;

-- Uma linha por aviso mandado, para nunca avisar duas vezes a mesma versão da despesa.
create table aviso_despesa (
  despesa_id uuid not null references despesa (id) on delete cascade,
  versao timestamptz not null,
  enviado_em timestamptz not null default now(),
  primary key (despesa_id, versao)
);
alter table aviso_despesa enable row level security; -- só a função (chave de serviço) usa

create function avisar_gestor() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if tg_op = 'INSERT' or (old.situacao = 'rejeitada' and new.situacao = 'pendente') then
    perform net.http_post(
      url := 'https://aiktjvxejegwxwkgzgbj.supabase.co/functions/v1/avisar-gestor',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return null;
end $$;

revoke execute on function public.avisar_gestor() from public, anon, authenticated;

create trigger despesa_avisar_gestor
  after insert or update on despesa
  for each row execute function avisar_gestor();

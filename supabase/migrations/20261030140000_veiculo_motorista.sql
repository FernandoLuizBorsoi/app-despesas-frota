-- Veículo fixo do motorista: o app já abre a despesa com essa placa marcada.
alter table public.usuario
  add column if not exists veiculo_id uuid references public.veiculo (id) on delete set null;

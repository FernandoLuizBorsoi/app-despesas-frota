-- Empresas novas já começam com Triagem e Descarga no lugar de Alimentação e Hospedagem.
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
    (nova, 'Triagem', false, false, 4),
    (nova, 'Descarga', false, false, 5),
    (nova, 'Estacionamento', false, false, 6),
    (nova, 'Lavagem', false, false, 7),
    (nova, 'Outros', false, false, 8);
  return nova;
end $$;

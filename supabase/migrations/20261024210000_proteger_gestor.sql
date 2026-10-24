-- Ninguém desativa o próprio acesso, e a empresa nunca fica sem um gestor ativo.
create or replace function proteger_gestor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.ativo and not new.ativo then
    if new.id = auth.uid() then
      raise exception 'Você não pode desativar o seu próprio acesso.';
    end if;
    if old.perfil <> 'motorista' and not exists (
      select 1 from usuario
      where empresa_id = old.empresa_id and id <> old.id and ativo and perfil <> 'motorista'
    ) then
      raise exception 'A empresa precisa de pelo menos um gestor ativo.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_gestor on usuario;
create trigger proteger_gestor before update of ativo on usuario
  for each row execute function proteger_gestor();

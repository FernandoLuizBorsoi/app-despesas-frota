-- O gestor pode excluir uma despesa lançada por engano. Ela não é apagada: fica com a situação
-- "excluida" e o motivo, sai dos totais e o motorista vê o aviso no app.
alter type situacao_despesa add value if not exists 'excluida';

create or replace function controlar_situacao_despesa() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  -- Gestor aprovando, rejeitando ou excluindo.
  if tg_op = 'UPDATE' and new.situacao is distinct from old.situacao and sou_gestor() then
    new.avaliado_em := case when new.situacao = 'pendente' then null else now() end;
    new.avaliado_por := case when new.situacao = 'pendente' then null else auth.uid() end;
    if new.situacao not in ('rejeitada', 'excluida') then
      new.motivo_rejeicao := old.motivo_rejeicao;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.situacao := 'pendente';
    new.motivo_rejeicao := null;
    new.avaliado_em := null;
    new.avaliado_por := null;
    return new;
  end if;

  -- Gestor corrigindo um dado de outra pessoa: a situação continua como está.
  if new.motorista_id <> auth.uid() and sou_gestor() then
    return new;
  end if;

  if old.situacao = 'aprovada' then
    raise exception 'Esta despesa já foi aprovada e não pode mais ser alterada.';
  end if;
  if old.situacao = 'excluida' then
    raise exception 'Esta despesa foi excluída pelo gestor e não pode mais ser alterada.';
  end if;
  new.situacao := 'pendente';
  new.motivo_rejeicao := old.motivo_rejeicao;
  new.avaliado_em := null;
  new.avaliado_por := null;
  return new;
end $$;

-- Logo da empresa, enviada pelo painel (Configurações) e mostrada no app e no painel.
alter table empresa add column logo_caminho text;

create policy empresa_gestao on empresa for update
  using (id = minha_empresa() and sou_gestor())
  with check (id = minha_empresa() and sou_gestor());

-- Bucket público (o endereço da logo abre sem login), mas só o gestor envia. Fica em marca/<empresa_id>/logo-<hora>.png
insert into storage.buckets (id, name, public) values ('marca', 'marca', true)
  on conflict (id) do nothing;

create policy marca_envio on storage.objects for insert
  with check (bucket_id = 'marca' and (storage.foldername(name))[1] = minha_empresa()::text and sou_gestor());

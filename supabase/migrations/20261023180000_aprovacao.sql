-- O gestor aprova ou rejeita cada despesa. Rejeitada volta para o motorista corrigir,
-- e ao reenviar ela fica aguardando aprovação de novo.
create type situacao_despesa as enum ('pendente', 'aprovada', 'rejeitada');

alter table despesa
  add column situacao situacao_despesa not null default 'pendente',
  add column motivo_rejeicao text,
  add column avaliado_em timestamptz,
  add column avaliado_por uuid references usuario (id);

create index despesa_situacao_idx on despesa (empresa_id, situacao);

-- Só o gestor muda a situação. Quando o motorista mexe numa despesa, ela volta a aguardar aprovação;
-- o motivo da rejeição fica guardado para o gestor ver o que foi pedido.
create function controlar_situacao_despesa() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  -- Gestor aprovando ou rejeitando.
  if tg_op = 'UPDATE' and new.situacao is distinct from old.situacao and sou_gestor() then
    new.avaliado_em := case when new.situacao = 'pendente' then null else now() end;
    new.avaliado_por := case when new.situacao = 'pendente' then null else auth.uid() end;
    if new.situacao <> 'rejeitada' then
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
  new.situacao := 'pendente';
  new.motivo_rejeicao := old.motivo_rejeicao;
  new.avaliado_em := null;
  new.avaliado_por := null;
  return new;
end $$;

revoke execute on function public.controlar_situacao_despesa() from public, anon, authenticated;

create trigger despesa_situacao
  before insert or update on despesa
  for each row execute function controlar_situacao_despesa();

-- Ao corrigir, o motorista pode trocar ou tirar fotos.
create policy comprovante_exclusao on comprovante for delete
  using (exists (
    select 1 from despesa d
    where d.id = despesa_id and d.motorista_id = auth.uid() and d.situacao <> 'aprovada'
  ));
create policy comprovante_foto_exclusao on storage.objects for delete
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = minha_empresa()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

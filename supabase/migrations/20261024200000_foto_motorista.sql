-- Foto do motorista: tirada por ele no app ou enviada pelo gestor no painel.
alter table usuario add column if not exists foto_caminho text;

-- Bucket privado: só o próprio motorista e os gestores da empresa veem.
insert into storage.buckets (id, name, public)
values ('fotos-usuarios', 'fotos-usuarios', false)
on conflict (id) do nothing;

-- Caminho: <empresa>/<usuario>/foto-<data>.jpg
create policy foto_usuario_envio on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos-usuarios'
  and (storage.foldername(name))[1] = minha_empresa()::text
  and ((storage.foldername(name))[2] = auth.uid()::text or sou_gestor())
);

create policy foto_usuario_leitura on storage.objects for select to authenticated
using (
  bucket_id = 'fotos-usuarios'
  and (storage.foldername(name))[1] = minha_empresa()::text
  and ((storage.foldername(name))[2] = auth.uid()::text or sou_gestor())
);

-- O motorista não pode editar a própria linha de usuario (mudaria o perfil);
-- esta função só troca a foto, dele mesmo ou, para o gestor, de alguém da empresa.
create or replace function definir_foto(p_usuario uuid, p_caminho text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from usuario where id = p_usuario;
  if v_empresa is null or v_empresa <> minha_empresa() then
    raise exception 'Usuário não encontrado.';
  end if;
  if p_usuario <> auth.uid() and not sou_gestor() then
    raise exception 'Só o gestor pode trocar a foto de outra pessoa.';
  end if;
  if p_caminho is not null and p_caminho not like v_empresa::text || '/' || p_usuario::text || '/%' then
    raise exception 'Caminho da foto inválido.';
  end if;
  update usuario set foto_caminho = p_caminho where id = p_usuario;
end;
$$;

revoke all on function definir_foto(uuid, text) from public, anon;
grant execute on function definir_foto(uuid, text) to authenticated;

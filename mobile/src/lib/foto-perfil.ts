// Foto do motorista: ele mesmo tira no app (ou o gestor envia pelo painel).
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import type { Perfil } from './tipos';

const BUCKET = 'fotos-usuarios';

// Busca a foto atual no servidor (o gestor pode ter trocado). Sem internet, não mostra.
export async function linkDaMinhaFoto(usuarioId: string): Promise<string | null> {
  const { data } = await supabase
    .from('usuario')
    .select('foto_caminho')
    .eq('id', usuarioId)
    .maybeSingle();
  const caminho = (data as { foto_caminho: string | null } | null)?.foto_caminho;
  if (!caminho) return null;
  const { data: link } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60 * 24);
  return link?.signedUrl ?? null;
}

// Devolve o novo endereço da foto, ou null se o motorista desistiu.
export async function trocarMinhaFoto(
  perfil: Perfil,
  origem: 'camera' | 'galeria',
): Promise<string | null> {
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    cameraType: ImagePicker.CameraType.front,
  };
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) throw new Error('Permita o uso da câmera para tirar sua foto.');
  }
  const resultado =
    origem === 'camera'
      ? await ImagePicker.launchCameraAsync(opcoes)
      : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (resultado.canceled) return null;

  const reduzida = await manipulateAsync(resultado.assets[0].uri, [{ resize: { width: 400 } }], {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  const caminho = `${perfil.empresa_id}/${perfil.id}/foto-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, await new File(reduzida.uri).arrayBuffer(), { contentType: 'image/jpeg' });
  if (error) throw new Error('Não foi possível enviar a foto. Confira a internet e tente de novo.');
  const { error: erroFoto } = await supabase.rpc('definir_foto', {
    p_usuario: perfil.id,
    p_caminho: caminho,
  });
  if (erroFoto) throw new Error(erroFoto.message);
  return linkDaMinhaFoto(perfil.id);
}

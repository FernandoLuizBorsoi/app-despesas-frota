// Fotos dos comprovantes: tira ou escolhe, reduz o tamanho e guarda até o envio.
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// Largura suficiente para ler um cupom fiscal; cada foto fica com cerca de 200 a 400 KB.
const LARGURA_MAXIMA = 1280;
const QUALIDADE_JPEG = 0.6;

const pasta = new Directory(Paths.document, 'comprovantes');

// Ao corrigir uma despesa, as fotos que já estão no servidor entram na lista com este prefixo
// seguido do caminho no bucket, e não são enviadas de novo.
export const PREFIXO_REMOTO = 'remoto:';

async function compactarEGuardar(uri: string, largura: number): Promise<string> {
  const reduzida = await manipulateAsync(
    uri,
    largura > LARGURA_MAXIMA ? [{ resize: { width: LARGURA_MAXIMA } }] : [],
    { compress: QUALIDADE_JPEG, format: SaveFormat.JPEG },
  );
  if (!pasta.exists) pasta.create({ intermediates: true });
  const arquivo = new File(reduzida.uri);
  // move é assíncrono: sem esperar, o uri ainda apontaria para o arquivo temporário.
  await arquivo.move(pasta);
  return arquivo.uri;
}

// "uri" é a foto reduzida que vai para o servidor; "original" é a foto inteira, melhor para ler o valor.
export type FotoNova = { uri: string; original: string };

export async function fotografarComprovante(): Promise<FotoNova | null> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) throw new Error('Permita o uso da câmera para fotografar o comprovante.');
  const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  if (resultado.canceled) return null;
  const foto = resultado.assets[0];
  return { uri: await compactarEGuardar(foto.uri, foto.width), original: foto.uri };
}

export async function escolherDaGaleria(): Promise<FotoNova[]> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 1,
  });
  if (resultado.canceled) return [];
  return Promise.all(
    resultado.assets.map(async (a) => ({ uri: await compactarEGuardar(a.uri, a.width), original: a.uri })),
  );
}

export async function lerBytes(uri: string): Promise<ArrayBuffer> {
  let arquivo = new File(uri);
  // A primeira versão do app guardava o endereço temporário da foto, que depois ia para a pasta
  // de comprovantes com o mesmo nome. Procura lá antes de desistir.
  if (!arquivo.exists) arquivo = new File(pasta, arquivo.name);
  if (!arquivo.exists) throw new Error('A foto do comprovante não foi encontrada no celular.');
  return arquivo.arrayBuffer();
}

export function apagarFoto(uri: string): void {
  if (uri.startsWith(PREFIXO_REMOTO)) return;
  const arquivo = new File(uri);
  if (arquivo.exists) arquivo.delete();
}

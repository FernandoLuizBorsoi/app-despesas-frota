// Envia ao servidor as despesas guardadas no celular e atualiza veículos e categorias.
// Cada passo pode ser repetido sem duplicar nada, então uma falha no meio só é tentada de novo.
import {
  cacheCategorias,
  cachePerfil,
  cacheVeiculos,
  listarPendentes,
  marcarEnviada,
  marcarErro,
} from './banco-local';
import { lerBytes } from './fotos';
import { BUCKET_COMPROVANTES, supabase } from './supabase';
import type { Categoria, DespesaLocal, Perfil, Veiculo } from './tipos';

export async function carregarPerfil(usuarioId: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, empresa_id, nome, perfil')
    .eq('id', usuarioId)
    .single();
  if (error) {
    const salvo = await cachePerfil.ler();
    if (salvo?.id === usuarioId) return salvo;
    throw new Error('Seu usuário ainda não foi cadastrado na frota. Fale com o gestor.');
  }
  await cachePerfil.gravar(data);
  return data;
}

export async function atualizarCadastros(): Promise<void> {
  const [veiculos, categorias] = await Promise.all([
    supabase.from('veiculo').select('id, placa, modelo, km_atual').eq('ativo', true).order('placa'),
    supabase
      .from('categoria')
      .select('id, nome, exige_km, exige_litros')
      .eq('ativa', true)
      .order('ordem'),
  ]);
  if (veiculos.data) await cacheVeiculos.gravar(veiculos.data as Veiculo[]);
  if (categorias.data) await cacheCategorias.gravar(categorias.data as Categoria[]);
}

async function enviarDespesa(d: DespesaLocal, perfil: Perfil): Promise<void> {
  const caminhos: string[] = [];
  for (const [ordem, uri] of d.fotos.entries()) {
    const caminho = `${perfil.empresa_id}/${perfil.id}/${d.id}/${ordem}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET_COMPROVANTES)
      .upload(caminho, await lerBytes(uri), { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    caminhos.push(caminho);
  }

  const { error: erroDespesa } = await supabase.from('despesa').upsert({
    id: d.id,
    empresa_id: perfil.empresa_id,
    motorista_id: perfil.id,
    veiculo_id: d.veiculo_id,
    categoria_id: d.categoria_id,
    data: d.data,
    valor: d.valor_centavos / 100,
    km_odometro: d.km_odometro,
    litros: d.litros,
    forma_pagamento: d.forma_pagamento,
    observacao: d.observacao,
  });
  if (erroDespesa) throw erroDespesa;

  if (caminhos.length > 0) {
    const { error } = await supabase
      .from('comprovante')
      .upsert(
        caminhos.map((caminho, ordem) => ({ despesa_id: d.id, ordem, caminho })),
        { onConflict: 'despesa_id,ordem' },
      );
    if (error) throw error;
  }
}

let emAndamento: Promise<number> | null = null;

// Devolve quantas despesas ainda faltam enviar.
export function sincronizar(perfil: Perfil): Promise<number> {
  emAndamento ??= (async () => {
    try {
      await atualizarCadastros().catch(() => undefined);
      const pendentes = await listarPendentes();
      let faltam = 0;
      for (const d of pendentes) {
        try {
          await enviarDespesa(d, perfil);
          await marcarEnviada(d.id);
        } catch (e) {
          faltam++;
          await marcarErro(d.id, e instanceof Error ? e.message : String(e));
        }
      }
      return faltam;
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

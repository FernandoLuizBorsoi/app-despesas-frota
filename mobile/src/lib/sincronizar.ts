// Envia ao servidor as despesas guardadas no celular e atualiza veículos e categorias.
// Cada passo pode ser repetido sem duplicar nada, então uma falha no meio só é tentada de novo.
import {
  cacheCategorias,
  cacheLogo,
  cacheMarcaDagua,
  cachePerfil,
  cacheVeiculos,
  listarPendentes,
  marcarEnviada,
  marcarErro,
} from './banco-local';
import { ehPdf, lerBytes, PREFIXO_REMOTO } from './fotos';
import { BUCKET_COMPROVANTES, BUCKET_MARCA, supabase } from './supabase';
import type { Categoria, DespesaLocal, Perfil, Veiculo } from './tipos';

export async function carregarPerfil(usuarioId: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from('usuario')
    .select('id, empresa_id, nome, perfil, ativo, empresa:empresa_id (id)')
    .eq('id', usuarioId)
    .single();
  if (error) {
    const salvo = await cachePerfil.ler();
    if (salvo?.id === usuarioId) return salvo;
    throw new Error('Seu usuário ainda não foi cadastrado na frota. Fale com o gestor.');
  }
  // Motorista desativado, ou empresa desativada pelo administrador (aí o banco não devolve a empresa).
  if (!data.ativo || !data.empresa) {
    throw new Error('Seu acesso está bloqueado. Fale com o gestor da sua empresa.');
  }
  const perfil: Perfil = { id: data.id, empresa_id: data.empresa_id, nome: data.nome, perfil: data.perfil };
  await cachePerfil.gravar(perfil);
  return perfil;
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
  const { data: empresa, error } = await supabase.from('empresa').select('logo_caminho, marca_dagua').maybeSingle();
  if (!error) {
    const dados = empresa as { logo_caminho: string | null; marca_dagua: boolean } | null;
    const caminho = dados?.logo_caminho ?? null;
    await cacheLogo.gravar(caminho ? supabase.storage.from(BUCKET_MARCA).getPublicUrl(caminho).data.publicUrl : null);
    await cacheMarcaDagua.gravar(Boolean(dados?.marca_dagua));
  }
}

async function enviarDespesa(d: DespesaLocal, perfil: Perfil): Promise<void> {
  const caminhos: string[] = [];
  for (const uri of d.fotos) {
    if (uri.startsWith(PREFIXO_REMOTO)) {
      caminhos.push(uri.slice(PREFIXO_REMOTO.length));
      continue;
    }
    // O nome do arquivo no celular é único, então reenviar não sobrescreve outra foto da despesa.
    const caminho = `${perfil.empresa_id}/${perfil.id}/${d.id}/${uri.split('/').pop()}`;
    const { error } = await supabase.storage
      .from(BUCKET_COMPROVANTES)
      .upload(caminho, await lerBytes(uri), { contentType: ehPdf(uri) ? 'application/pdf' : 'image/jpeg', upsert: true });
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
  // Fotos que o motorista removeu ao corrigir a despesa.
  const { error: erroSobra } = await supabase
    .from('comprovante')
    .delete()
    .eq('despesa_id', d.id)
    .gte('ordem', caminhos.length);
  if (erroSobra) throw erroSobra;
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
          const mensagem = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
          // Já estava no servidor e o gestor aprovou ou excluiu: não há mais nada a enviar.
          if (mensagem.includes('já foi aprovada') || mensagem.includes('foi excluída')) {
            await marcarEnviada(d.id);
            continue;
          }
          faltam++;
          await marcarErro(d.id, mensagem);
        }
      }
      return faltam;
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

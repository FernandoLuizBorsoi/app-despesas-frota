import { supabase } from "./supabase";

export type Opcao = { id: string; nome: string };

export type Veiculo = {
  id: string;
  placa: string;
  modelo: string | null;
  ano: number | null;
  km_atual: number;
  ativo: boolean;
};

export type Despesa = {
  id: string;
  data: string;
  valor: number;
  km_odometro: number | null;
  litros: number | null;
  forma_pagamento: string | null;
  observacao: string | null;
  motorista_id: string;
  veiculo_id: string;
  categoria_id: string;
  motorista: { nome: string } | null;
  veiculo: { placa: string } | null;
  categoria: { nome: string } | null;
  comprovante: { caminho: string; ordem: number }[];
  situacao: Situacao;
  motivo_rejeicao: string | null;
};

export type Situacao = "pendente" | "aprovada" | "rejeitada";

export const NOMES_SITUACAO: Record<Situacao, string> = {
  pendente: "Aguardando aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export type Filtros = {
  de: string;
  ate: string;
  motoristaId: string;
  veiculoId: string;
  categoriaId: string;
  situacao: string;
};

export async function carregarOpcoes() {
  const [motoristas, veiculos, categorias] = await Promise.all([
    supabase.from("usuario").select("id, nome").order("nome"),
    supabase.from("veiculo").select("id, placa").order("placa"),
    supabase.from("categoria").select("id, nome").order("ordem"),
  ]);
  return {
    motoristas: (motoristas.data ?? []) as Opcao[],
    veiculos: ((veiculos.data ?? []) as { id: string; placa: string }[]).map((v) => ({ id: v.id, nome: v.placa })),
    categorias: (categorias.data ?? []) as Opcao[],
  };
}

export async function buscarDespesas(f: Filtros): Promise<Despesa[]> {
  let consulta = supabase
    .from("despesa")
    .select(
      "id, data, valor, km_odometro, litros, forma_pagamento, observacao, motorista_id, veiculo_id, categoria_id," +
        " motorista:usuario!despesa_motorista_id_fkey(nome), veiculo:veiculo(placa), categoria:categoria(nome), comprovante(caminho, ordem)," +
        " situacao, motivo_rejeicao",
    )
    .gte("data", f.de)
    .lte("data", f.ate)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(5000);
  if (f.motoristaId) consulta = consulta.eq("motorista_id", f.motoristaId);
  if (f.veiculoId) consulta = consulta.eq("veiculo_id", f.veiculoId);
  if (f.categoriaId) consulta = consulta.eq("categoria_id", f.categoriaId);
  if (f.situacao) consulta = consulta.eq("situacao", f.situacao);
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as unknown as Despesa[];
}

// Aprova ou rejeita; ao rejeitar, o motivo aparece no app do motorista.
export async function avaliarDespesa(id: string, situacao: "aprovada" | "rejeitada", motivo?: string) {
  const { error } = await supabase
    .from("despesa")
    .update(situacao === "rejeitada" ? { situacao, motivo_rejeicao: motivo } : { situacao })
    .eq("id", id);
  if (error) throw error;
}

export async function linksDasFotos(caminhos: string[]): Promise<string[]> {
  if (caminhos.length === 0) return [];
  const { data, error } = await supabase.storage.from("comprovantes").createSignedUrls(caminhos, 60 * 10);
  if (error) throw error;
  return data.map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}

export function primeiroDiaDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

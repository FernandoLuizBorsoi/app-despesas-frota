import { supabase } from "./supabase";

export type Opcao = { id: string; nome: string };

export type Veiculo = {
  id: string;
  placa: string;
  modelo: string | null;
  ano: number | null;
  km_atual: number;
  ativo: boolean;
  oculto?: boolean;
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
  motorista: { nome: string; foto_caminho: string | null } | null;
  veiculo: { placa: string } | null;
  categoria: { nome: string } | null;
  comprovante: { caminho: string; ordem: number }[];
  situacao: Situacao;
  motivo_rejeicao: string | null;
};

export type Situacao = "pendente" | "aprovada" | "rejeitada" | "excluida";

export const NOMES_SITUACAO: Record<Situacao, string> = {
  pendente: "Aguardando aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  excluida: "Excluída",
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
        " motorista:usuario!despesa_motorista_id_fkey(nome, foto_caminho), veiculo:veiculo(placa), categoria:categoria(nome), comprovante(caminho, ordem)," +
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
  // Excluídas só aparecem quando o filtro pede por elas, e nunca entram nos totais.
  consulta = f.situacao ? consulta.eq("situacao", f.situacao) : consulta.neq("situacao", "excluida");
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []) as unknown as Despesa[];
}

// Aprova, rejeita ou exclui; ao rejeitar ou excluir, o motivo aparece no app do motorista.
export async function avaliarDespesa(id: string, situacao: "aprovada" | "rejeitada" | "excluida", motivo?: string) {
  const { error } = await supabase
    .from("despesa")
    .update(situacao === "aprovada" ? { situacao } : { situacao, motivo_rejeicao: motivo })
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

export type Empresa = { id: string; nome: string; logo_caminho: string | null; marca_dagua: boolean; manutencao_ativa: boolean };

// A empresa de quem está logado. O administrador geral enxerga todas, por isso filtra pelo usuário.
export async function carregarEmpresa(): Promise<Empresa | null> {
  const { data: sessao } = await supabase.auth.getSession();
  const id = sessao.session?.user.id;
  if (!id) return null;
  const { data } = await supabase
    .from("usuario")
    .select("empresa:empresa_id (id, nome, logo_caminho, marca_dagua, manutencao_ativa)")
    .eq("id", id)
    .maybeSingle();
  return (data?.empresa as unknown as Empresa) ?? null;
}

// Só o administrador geral recebe a lista (as regras do banco filtram para os demais).
export async function listarEmpresas(): Promise<{ id: string; nome: string; ativa: boolean }[]> {
  const { data, error } = await supabase.from("empresa").select("id, nome, ativa").order("nome");
  if (error) throw error;
  return data;
}

export async function trocarEmpresa(empresaId: string) {
  const { error } = await supabase.rpc("trocar_empresa", { p_empresa: empresaId });
  if (error) throw error;
}

export async function ligarMarcaDagua(empresa: Empresa, ligada: boolean) {
  const { error } = await supabase.from("empresa").update({ marca_dagua: ligada }).eq("id", empresa.id);
  if (error) throw error;
}

export async function ligarManutencao(empresa: Empresa, ligada: boolean) {
  const { error } = await supabase.from("empresa").update({ manutencao_ativa: ligada }).eq("id", empresa.id);
  if (error) throw error;
}

// Só o administrador geral: ocultar some da visão do gestor e do app (o histórico fica guardado);
// excluir apaga de vez, junto com as despesas ligadas.
export async function ocultar(tabela: "usuario" | "veiculo", id: string, oculto: boolean) {
  const { error } = await supabase
    .from(tabela)
    .update(oculto ? { oculto, ativo: false } : { oculto })
    .eq("id", id);
  if (error) throw error;
}

export async function excluirDeVez(tipo: "motorista" | "veiculo", id: string) {
  const { error } =
    tipo === "motorista"
      ? await supabase.rpc("excluir_motorista", { p_usuario: id })
      : await supabase.rpc("excluir_veiculo", { p_veiculo: id });
  if (error) throw error;
}

// Empresa desativada: gestores e motoristas dela perdem o acesso na hora (o histórico fica guardado).
export async function ativarEmpresa(empresaId: string, ativa: boolean) {
  const { error } = await supabase.from("empresa").update({ ativa }).eq("id", empresaId);
  if (error) throw error;
}

export async function criarEmpresa(nome: string): Promise<string> {
  const { data, error } = await supabase.rpc("criar_empresa", { p_nome: nome });
  if (error) throw error;
  return data as string;
}

export function linkDaLogo(caminho: string | null): string | null {
  return caminho ? supabase.storage.from("marca").getPublicUrl(caminho).data.publicUrl : null;
}

export async function renomearEmpresa(empresa: Empresa, nome: string) {
  const { error } = await supabase.from("empresa").update({ nome }).eq("id", empresa.id);
  if (error) throw error;
}

// Cada envio ganha um nome novo, para o celular e o navegador não mostrarem a logo antiga guardada.
export async function trocarLogo(empresa: Empresa, arquivo: File | null) {
  let caminho: string | null = null;
  if (arquivo) {
    const extensao = arquivo.type === "image/png" ? "png" : "jpg";
    caminho = `${empresa.id}/logo-${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from("marca").upload(caminho, arquivo, { contentType: arquivo.type });
    if (error) throw error;
  }
  const { error } = await supabase.from("empresa").update({ logo_caminho: caminho }).eq("id", empresa.id);
  if (error) throw error;
}

// Fotos dos motoristas (bucket privado): endereços temporários para mostrar na tela.
export async function linksDasFotosDeUsuarios(caminhos: string[]): Promise<Map<string, string>> {
  if (caminhos.length === 0) return new Map();
  const { data } = await supabase.storage.from("fotos-usuarios").createSignedUrls(caminhos, 60 * 60);
  return new Map((data ?? []).map((d, i) => [caminhos[i], d.signedUrl ?? ""]));
}

export async function enviarFotoUsuario(empresaId: string, usuarioId: string, arquivo: File) {
  const caminho = `${empresaId}/${usuarioId}/foto-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("fotos-usuarios")
    .upload(caminho, arquivo, { contentType: arquivo.type || "image/jpeg" });
  if (error) throw error;
  const { error: erroFoto } = await supabase.rpc("definir_foto", { p_usuario: usuarioId, p_caminho: caminho });
  if (erroFoto) throw erroFoto;
}

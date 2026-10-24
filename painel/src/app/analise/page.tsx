"use client";

import { useEffect, useMemo, useState } from "react";
import { FILTROS_INICIAIS, FiltrosDespesas } from "@/components/FiltrosDespesas";
import { carregarOpcoes, hoje, type Despesa, type Filtros, type Opcao } from "@/lib/dados";
import { reais } from "@/lib/formato";
import { useDespesas } from "@/lib/useDespesas";

// Cores fixas por categoria, na ordem do cadastro: a mesma categoria tem sempre a mesma cor.
// Ordem testada para quem tem daltonismo (vizinhas sempre distinguíveis).
const CORES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const COR_OUTRAS = "#8a8f98";
const COR_BARRA = "#2a78d6";
const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Análise começa nos últimos 6 meses, para já mostrar a evolução.
function inicioSeisMeses(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  let [ano, mes] = de.slice(0, 7).split("-").map(Number);
  const fim = ate.slice(0, 7);
  for (let i = 0; i < 36; i++) {
    const chave = `${ano}-${String(mes).padStart(2, "0")}`;
    if (chave > fim) break;
    meses.push(chave);
    mes++;
    if (mes > 12) {
      mes = 1;
      ano++;
    }
  }
  return meses;
}

const nomeMes = (chave: string) => `${NOMES_MES[Number(chave.slice(5, 7)) - 1]}/${chave.slice(2, 4)}`;

// Topo do eixo arredondado (1, 2 ou 5 × potência de 10), para as linhas de grade caírem em valores redondos.
function topoRedondo(valor: number): number {
  if (valor <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  return ([1, 2, 5, 10].find((m) => m * potencia >= valor) ?? 10) * potencia;
}

const reaisCurto = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : reais(v);

type Dica = { x: number; y: number; titulo: string; linhas: [string, string][] };

type Grupo = { id: string; nome: string; total: number; quantidade: number };

function agrupar(despesas: Despesa[], id: (d: Despesa) => string, nome: (d: Despesa) => string): Grupo[] {
  const mapa = new Map<string, Grupo>();
  for (const d of despesas) {
    const chave = id(d);
    const g = mapa.get(chave) ?? { id: chave, nome: nome(d), total: 0, quantidade: 0 };
    g.total += Number(d.valor);
    g.quantidade++;
    mapa.set(chave, g);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export default function Analise() {
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_INICIAIS, de: inicioSeisMeses(), ate: hoje() });
  const { despesas, erro, carregando } = useDespesas(filtros);
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [dica, setDica] = useState<Dica | null>(null);

  useEffect(() => {
    carregarOpcoes().then((o) => setCategorias(o.categorias));
  }, []);

  const corDaCategoria = useMemo(() => {
    const mapa = new Map(categorias.map((c, i) => [c.id, CORES[i] ?? COR_OUTRAS]));
    return (id: string) => mapa.get(id) ?? COR_OUTRAS;
  }, [categorias]);

  const total = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const aguardando = despesas.filter((d) => d.situacao === "pendente");
  const porCategoria = useMemo(
    () => agrupar(despesas, (d) => d.categoria_id, (d) => d.categoria?.nome ?? "?"),
    [despesas],
  );
  const porVeiculo = useMemo(
    () => agrupar(despesas, (d) => d.veiculo_id, (d) => d.veiculo?.placa ?? "?"),
    [despesas],
  );
  const porMotorista = useMemo(
    () => agrupar(despesas, (d) => d.motorista_id, (d) => d.motorista?.nome ?? "?"),
    [despesas],
  );
  const porPagamento = useMemo(
    () => agrupar(despesas, (d) => d.forma_pagamento ?? "", (d) => d.forma_pagamento ?? "Não informado"),
    [despesas],
  );

  const meses = useMemo(() => {
    const lista = mesesEntre(filtros.de, filtros.ate).map((chave) => ({
      chave,
      total: 0,
      porCategoria: new Map<string, number>(),
    }));
    const indice = new Map(lista.map((m, i) => [m.chave, i]));
    for (const d of despesas) {
      const m = lista[indice.get(d.data.slice(0, 7)) ?? -1];
      if (!m) continue;
      m.total += Number(d.valor);
      m.porCategoria.set(d.categoria_id, (m.porCategoria.get(d.categoria_id) ?? 0) + Number(d.valor));
    }
    return lista;
  }, [despesas, filtros.de, filtros.ate]);

  // Categorias na ordem do cadastro, para a pilha e a legenda ficarem sempre iguais.
  const ordemCategorias = useMemo(() => {
    const usadas = new Set(despesas.map((d) => d.categoria_id));
    const nomes = new Map(porCategoria.map((g) => [g.id, g.nome]));
    const conhecidas = categorias.filter((c) => usadas.has(c.id)).map((c) => ({ id: c.id, nome: c.nome }));
    const extras = [...usadas].filter((id) => !categorias.some((c) => c.id === id));
    return [...conhecidas, ...extras.map((id) => ({ id, nome: nomes.get(id) ?? "?" }))];
  }, [categorias, despesas, porCategoria]);

  const mostrarDica = (e: React.MouseEvent, titulo: string, linhas: [string, string][]) =>
    setDica({ x: e.clientX, y: e.clientY, titulo, linhas });

  const filtrar = (campo: "categoriaId" | "veiculoId" | "motoristaId", id: string) =>
    setFiltros({ ...filtros, [campo]: filtros[campo] === id ? "" : id });

  const topo = topoRedondo(Math.max(0, ...meses.map((m) => m.total)));
  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => f * topo);
  const mesAnterior = meses.at(-2);
  const mesAtual = meses.at(-1);
  const variacao =
    mesAnterior && mesAtual && mesAnterior.total > 0 ? (mesAtual.total / mesAnterior.total - 1) * 100 : null;

  return (
    <>
      <h1>Análise</h1>
      <FiltrosDespesas filtros={filtros} aoMudar={setFiltros} />
      {erro && <p className="erro">{erro}</p>}

      <div className="resumo">
        <div className="cartao">
          <div className="rotulo-suave">Gasto no período</div>
          <div className="valor">{reais(total)}</div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Lançamentos</div>
          <div className="valor">{despesas.length}</div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Valor médio por lançamento</div>
          <div className="valor">{despesas.length ? reais(total / despesas.length) : "—"}</div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Mês atual × mês anterior</div>
          <div className="valor">
            {variacao === null ? "—" : `${variacao > 0 ? "▲ +" : variacao < 0 ? "▼ " : ""}${variacao.toFixed(0)}%`}
          </div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Aguardando aprovação</div>
          <div className="valor">{aguardando.length}</div>
          <div className="rotulo-suave">{reais(aguardando.reduce((s, d) => s + Number(d.valor), 0))}</div>
        </div>
      </div>

      <div className="cartao">
        <h2>Gasto por mês</h2>
        <div className="legenda">
          {ordemCategorias.map((c) => (
            <span key={c.id}>
              <i style={{ background: corDaCategoria(c.id) }} />
              {c.nome}
            </span>
          ))}
        </div>
        {carregando && despesas.length === 0 ? (
          <p>Carregando...</p>
        ) : (
          <div className="colunas" onMouseLeave={() => setDica(null)}>
            <div className="colunas-grade">
              {grade.map((v) => (
                <div key={v} style={{ bottom: `${(v / topo) * 100}%` }}>
                  <span>{reaisCurto(v)}</span>
                </div>
              ))}
            </div>
            {meses.map((m) => (
              <div key={m.chave} className="coluna">
                <div className="coluna-area">
                  {m.total > 0 && <div className="coluna-total">{reaisCurto(m.total)}</div>}
                  <div className="coluna-pilha" style={{ height: `${(m.total / topo) * 100}%` }}>
                    {ordemCategorias
                      .filter((c) => m.porCategoria.has(c.id))
                      .map((c) => {
                        const valor = m.porCategoria.get(c.id)!;
                        return (
                          <div
                            key={c.id}
                            className="segmento"
                            style={{ flexGrow: valor, background: corDaCategoria(c.id) }}
                            onMouseMove={(e) =>
                              mostrarDica(e, nomeMes(m.chave), [
                                [c.nome, reais(valor)],
                                ["Total do mês", reais(m.total)],
                              ])
                            }
                            onClick={() => filtrar("categoriaId", c.id)}
                          />
                        );
                      })}
                  </div>
                </div>
                <div className="coluna-rotulo">{nomeMes(m.chave)}</div>
              </div>
            ))}
          </div>
        )}
        <p className="rotulo-suave dica-grafico">
          Passe o mouse para ver os valores. Clique numa cor para ver só aquela categoria.
        </p>
      </div>

      <div className="grade-relatorios">
        <Barras
          titulo="Por categoria"
          grupos={porCategoria}
          total={total}
          cor={(g) => corDaCategoria(g.id)}
          selecionado={filtros.categoriaId}
          aoClicar={(id) => filtrar("categoriaId", id)}
          aoPassar={mostrarDica}
          aoSair={() => setDica(null)}
        />
        <Barras
          titulo="Por veículo"
          grupos={porVeiculo}
          total={total}
          selecionado={filtros.veiculoId}
          aoClicar={(id) => filtrar("veiculoId", id)}
          aoPassar={mostrarDica}
          aoSair={() => setDica(null)}
        />
        <Barras
          titulo="Por motorista"
          grupos={porMotorista}
          total={total}
          selecionado={filtros.motoristaId}
          aoClicar={(id) => filtrar("motoristaId", id)}
          aoPassar={mostrarDica}
          aoSair={() => setDica(null)}
        />
        <Barras
          titulo="Por forma de pagamento"
          grupos={porPagamento}
          total={total}
          aoPassar={mostrarDica}
          aoSair={() => setDica(null)}
        />
      </div>

      {dica && (
        <div className="dica-flutuante" style={{ left: dica.x + 14, top: dica.y + 14 }}>
          <strong>{dica.titulo}</strong>
          {dica.linhas.map(([r, v]) => (
            <div key={r}>
              {r}: <b>{v}</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const LIMITE_BARRAS = 10;

function Barras(props: {
  titulo: string;
  grupos: Grupo[];
  total: number;
  cor?: (g: Grupo) => string;
  selecionado?: string;
  aoClicar?: (id: string) => void;
  aoPassar: (e: React.MouseEvent, titulo: string, linhas: [string, string][]) => void;
  aoSair: () => void;
}) {
  const visiveis = props.grupos.slice(0, LIMITE_BARRAS);
  const resto = props.grupos.slice(LIMITE_BARRAS);
  const maior = Math.max(1, ...props.grupos.map((g) => g.total));
  return (
    <div className="cartao">
      <h2>{props.titulo}</h2>
      {props.grupos.length === 0 && <p className="rotulo-suave">Nenhuma despesa no período.</p>}
      <div className="barras" onMouseLeave={props.aoSair}>
        {visiveis.map((g) => (
          <div
            key={g.id}
            className={`barra-linha${props.aoClicar ? " clicavel" : ""}${props.selecionado === g.id ? " selecionada" : ""}`}
            onClick={() => props.aoClicar?.(g.id)}
            onMouseMove={(e) =>
              props.aoPassar(e, g.nome, [
                ["Total", reais(g.total)],
                ["Lançamentos", String(g.quantidade)],
                ["Parte do total", `${props.total ? ((g.total / props.total) * 100).toFixed(1) : 0}%`],
              ])
            }
          >
            <div className="barra-nome">{g.nome}</div>
            <div className="barra-trilho">
              <div
                className="barra-cheia"
                style={{ width: `${(g.total / maior) * 100}%`, background: props.cor?.(g) ?? COR_BARRA }}
              />
            </div>
            <div className="barra-valor">{reais(g.total)}</div>
          </div>
        ))}
        {resto.length > 0 && (
          <p className="rotulo-suave">
            + {resto.length} outros, somando {reais(resto.reduce((s, g) => s + g.total, 0))}
          </p>
        )}
      </div>
      {props.aoClicar && props.grupos.length > 0 && (
        <p className="rotulo-suave dica-grafico">Clique numa barra para filtrar; clique de novo para voltar.</p>
      )}
    </div>
  );
}

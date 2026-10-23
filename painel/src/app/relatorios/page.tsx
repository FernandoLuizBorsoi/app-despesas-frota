"use client";

import { useMemo, useState } from "react";
import { FILTROS_INICIAIS, FiltrosDespesas } from "@/components/FiltrosDespesas";
import type { Despesa, Filtros } from "@/lib/dados";
import { baixarCsv, numero, reais } from "@/lib/formato";
import { useDespesas } from "@/lib/useDespesas";

type Linha = { nome: string; total: number; quantidade: number };

function agrupar(despesas: Despesa[], chave: (d: Despesa) => string): Linha[] {
  const mapa = new Map<string, Linha>();
  for (const d of despesas) {
    const nome = chave(d);
    const linha = mapa.get(nome) ?? { nome, total: 0, quantidade: 0 };
    linha.total += Number(d.valor);
    linha.quantidade++;
    mapa.set(nome, linha);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

type LinhaVeiculo = {
  placa: string;
  total: number;
  kmRodado: number | null;
  custoPorKm: number | null;
  litros: number;
  kmPorLitro: number | null;
};

// Km rodado = maior km - menor km lançados no período.
// Consumo = km entre o primeiro e o último abastecimento / litros abastecidos depois do primeiro
// (o primeiro abastecimento repõe combustível gasto antes do período).
function porVeiculo(despesas: Despesa[]): LinhaVeiculo[] {
  const grupos = new Map<string, Despesa[]>();
  for (const d of despesas) {
    const placa = d.veiculo?.placa ?? "?";
    grupos.set(placa, [...(grupos.get(placa) ?? []), d]);
  }
  return [...grupos.entries()]
    .map(([placa, lista]) => {
      const total = lista.reduce((s, d) => s + Number(d.valor), 0);
      const kms = lista.map((d) => d.km_odometro).filter((k): k is number => k !== null);
      const kmRodado = kms.length >= 2 ? Math.max(...kms) - Math.min(...kms) : null;
      const abastecimentos = lista
        .filter((d) => d.litros !== null && d.km_odometro !== null)
        .sort((a, b) => a.km_odometro! - b.km_odometro!);
      const litros = lista.reduce((s, d) => s + (d.litros === null ? 0 : Number(d.litros)), 0);
      let kmPorLitro: number | null = null;
      if (abastecimentos.length >= 2) {
        const km = abastecimentos.at(-1)!.km_odometro! - abastecimentos[0].km_odometro!;
        const litrosConsumidos = abastecimentos.slice(1).reduce((s, d) => s + Number(d.litros), 0);
        if (km > 0 && litrosConsumidos > 0) kmPorLitro = km / litrosConsumidos;
      }
      return {
        placa,
        total,
        kmRodado,
        custoPorKm: kmRodado ? total / kmRodado : null,
        litros,
        kmPorLitro,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export default function Relatorios() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const { despesas, erro } = useDespesas(filtros);

  const categorias = useMemo(() => agrupar(despesas, (d) => d.categoria?.nome ?? "?"), [despesas]);
  const motoristas = useMemo(() => agrupar(despesas, (d) => d.motorista?.nome ?? "?"), [despesas]);
  const veiculos = useMemo(() => porVeiculo(despesas), [despesas]);
  const total = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const kmTotal = veiculos.reduce((s, v) => s + (v.kmRodado ?? 0), 0);

  function exportarVeiculos() {
    baixarCsv(
      `custos_por_veiculo_${filtros.de}_a_${filtros.ate}.csv`,
      ["Veículo", "Total (R$)", "Km rodado", "Custo por km (R$)", "Litros", "Consumo (km/l)"],
      veiculos.map((v) => [
        v.placa,
        Number(v.total.toFixed(2)),
        v.kmRodado,
        v.custoPorKm === null ? null : Number(v.custoPorKm.toFixed(2)),
        Number(v.litros.toFixed(2)),
        v.kmPorLitro === null ? null : Number(v.kmPorLitro.toFixed(2)),
      ]),
    );
  }

  return (
    <>
      <h1>Relatórios</h1>
      <FiltrosDespesas filtros={filtros} aoMudar={setFiltros} />
      {erro && <p className="erro">{erro}</p>}

      <div className="resumo">
        <div className="cartao">
          <div className="rotulo-suave">Gasto total</div>
          <div className="valor">{reais(total)}</div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Km rodado (frota)</div>
          <div className="valor">{numero(kmTotal)} km</div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Custo médio por km</div>
          <div className="valor">{kmTotal > 0 ? reais(total / kmTotal) : "—"}</div>
        </div>
      </div>

      <div className="cartao tabela-rolagem">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Por veículo</h2>
          <button className="botao secundario" onClick={exportarVeiculos} disabled={veiculos.length === 0}>
            Exportar para Excel
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th className="numero">Total</th>
              <th className="numero">Km rodado</th>
              <th className="numero">Custo/km</th>
              <th className="numero">Litros</th>
              <th className="numero">Consumo</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => (
              <tr key={v.placa}>
                <td>{v.placa}</td>
                <td className="numero">{reais(v.total)}</td>
                <td className="numero">{v.kmRodado === null ? "—" : numero(v.kmRodado)}</td>
                <td className="numero">{v.custoPorKm === null ? "—" : reais(v.custoPorKm)}</td>
                <td className="numero">{numero(v.litros, 1)}</td>
                <td className="numero">{v.kmPorLitro === null ? "—" : `${numero(v.kmPorLitro, 1)} km/l`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grade-relatorios">
        <TabelaComBarras titulo="Por categoria" linhas={categorias} />
        <TabelaComBarras titulo="Por motorista" linhas={motoristas} />
      </div>
    </>
  );
}

function TabelaComBarras({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  const maior = Math.max(1, ...linhas.map((l) => l.total));
  return (
    <div className="cartao">
      <h2>{titulo}</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th style={{ width: "35%" }}></th>
            <th className="numero">Qtd.</th>
            <th className="numero">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td>{l.nome}</td>
              <td>
                <div className="barra" style={{ width: `${(l.total / maior) * 100}%` }} />
              </td>
              <td className="numero">{l.quantidade}</td>
              <td className="numero">{reais(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

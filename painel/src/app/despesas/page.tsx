"use client";

import { useEffect, useState } from "react";
import { FILTROS_INICIAIS, FiltrosDespesas } from "@/components/FiltrosDespesas";
import { linksDasFotos, type Despesa, type Filtros } from "@/lib/dados";
import { baixarCsv, dataBr, numero, reais } from "@/lib/formato";
import { useDespesas } from "@/lib/useDespesas";

export default function Despesas() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const { despesas, erro, carregando } = useDespesas(filtros);
  const [aberta, setAberta] = useState<Despesa | null>(null);

  const total = despesas.reduce((soma, d) => soma + Number(d.valor), 0);

  function exportar() {
    baixarCsv(
      `despesas_${filtros.de}_a_${filtros.ate}.csv`,
      ["Data", "Motorista", "Veículo", "Categoria", "Valor (R$)", "Km", "Litros", "Pagamento", "Observação", "Fotos"],
      despesas.map((d) => [
        dataBr(d.data),
        d.motorista?.nome ?? "",
        d.veiculo?.placa ?? "",
        d.categoria?.nome ?? "",
        Number(d.valor),
        d.km_odometro,
        d.litros === null ? null : Number(d.litros),
        d.forma_pagamento,
        d.observacao,
        d.comprovante.length,
      ]),
    );
  }

  return (
    <>
      <h1>Despesas</h1>
      <FiltrosDespesas filtros={filtros} aoMudar={setFiltros}>
        <button className="botao secundario" onClick={exportar} disabled={despesas.length === 0}>
          Exportar para Excel
        </button>
      </FiltrosDespesas>

      <div className="resumo">
        <div className="cartao">
          <div className="rotulo-suave">Total no período</div>
          <div className="valor">{reais(total)}</div>
        </div>
        <div className="cartao">
          <div className="rotulo-suave">Lançamentos</div>
          <div className="valor">{despesas.length}</div>
        </div>
      </div>

      <div className="cartao tabela-rolagem">
        {erro && <p className="erro">{erro}</p>}
        {carregando ? (
          <p>Carregando...</p>
        ) : despesas.length === 0 ? (
          <p className="rotulo-suave">Nenhuma despesa nesse período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Motorista</th>
                <th>Veículo</th>
                <th>Categoria</th>
                <th className="numero">Km</th>
                <th className="numero">Valor</th>
                <th>Fotos</th>
              </tr>
            </thead>
            <tbody>
              {despesas.map((d) => (
                <tr key={d.id} className="clicavel" onClick={() => setAberta(d)}>
                  <td>{dataBr(d.data)}</td>
                  <td>{d.motorista?.nome}</td>
                  <td>{d.veiculo?.placa}</td>
                  <td>{d.categoria?.nome}</td>
                  <td className="numero">{d.km_odometro === null ? "" : numero(d.km_odometro)}</td>
                  <td className="numero">{reais(Number(d.valor))}</td>
                  <td>{d.comprovante.length > 0 ? `Ver (${d.comprovante.length})` : "Sem foto"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {aberta && <DetalheDespesa despesa={aberta} aoFechar={() => setAberta(null)} />}
    </>
  );
}

function DetalheDespesa({ despesa: d, aoFechar }: { despesa: Despesa; aoFechar: () => void }) {
  const [fotos, setFotos] = useState<string[] | null>(null);

  useEffect(() => {
    const caminhos = [...d.comprovante].sort((a, b) => a.ordem - b.ordem).map((c) => c.caminho);
    linksDasFotos(caminhos)
      .then(setFotos)
      .catch(() => setFotos([]));
  }, [d]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return (
    <div className="fundo-modal" onClick={aoFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <h2>
            {d.categoria?.nome} · {reais(Number(d.valor))}
          </h2>
          <button className="botao secundario" onClick={aoFechar}>
            Fechar
          </button>
        </div>
        <table>
          <tbody>
            <tr><th>Data</th><td>{dataBr(d.data)}</td></tr>
            <tr><th>Motorista</th><td>{d.motorista?.nome}</td></tr>
            <tr><th>Veículo</th><td>{d.veiculo?.placa}</td></tr>
            {d.km_odometro !== null && <tr><th>Km</th><td>{numero(d.km_odometro)}</td></tr>}
            {d.litros !== null && <tr><th>Litros</th><td>{numero(Number(d.litros), 2)}</td></tr>}
            {d.forma_pagamento && <tr><th>Pagamento</th><td>{d.forma_pagamento}</td></tr>}
            {d.observacao && <tr><th>Observação</th><td>{d.observacao}</td></tr>}
          </tbody>
        </table>
        <div className="fotos">
          {fotos === null && <p>Carregando fotos...</p>}
          {fotos?.length === 0 && <p className="rotulo-suave">Sem fotos.</p>}
          {fotos?.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Comprovante" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

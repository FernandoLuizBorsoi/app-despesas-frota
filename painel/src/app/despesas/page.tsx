"use client";

import { useEffect, useState } from "react";
import { FILTROS_INICIAIS, FiltrosDespesas } from "@/components/FiltrosDespesas";
import {
  avaliarDespesa,
  linksDasFotos,
  linksDasFotosDeUsuarios,
  NOMES_SITUACAO,
  type Despesa,
  type Filtros,
} from "@/lib/dados";
import { baixarCsv, dataBr, iniciais, numero, reais } from "@/lib/formato";
import { useDespesas } from "@/lib/useDespesas";

export default function Despesas() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const { despesas, erro, carregando, recarregar } = useDespesas(filtros);
  const [aberta, setAberta] = useState<Despesa | null>(null);

  const total = despesas.reduce((soma, d) => soma + Number(d.valor), 0);
  const aguardando = despesas.filter((d) => d.situacao === "pendente").length;

  function exportar() {
    baixarCsv(
      `despesas_${filtros.de}_a_${filtros.ate}.csv`,
      ["Data", "Motorista", "Veículo", "Categoria", "Valor (R$)", "Km", "Litros", "Pagamento", "Observação", "Fotos", "Situação", "Motivo da rejeição"],
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
        NOMES_SITUACAO[d.situacao],
        d.motivo_rejeicao,
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
        <div
          className="cartao clicavel"
          title="Mostrar só as que aguardam aprovação"
          onClick={() => setFiltros({ ...filtros, situacao: "pendente" })}
        >
          <div className="rotulo-suave">Aguardando aprovação</div>
          <div className="valor">{aguardando}</div>
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
                <th>Situação</th>
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
                  <td>{d.comprovante.length > 0 ? `Ver (${d.comprovante.length})` : "Sem anexo"}</td>
                  <td>
                    <span className={`selo ${d.situacao}`}>{NOMES_SITUACAO[d.situacao]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {aberta && (
        <DetalheDespesa
          despesa={aberta}
          aoFechar={() => setAberta(null)}
          aoAvaliar={() => {
            setAberta(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

function DetalheDespesa({
  despesa: d,
  aoFechar,
  aoAvaliar,
}: {
  despesa: Despesa;
  aoFechar: () => void;
  aoAvaliar: () => void;
}) {
  const [fotos, setFotos] = useState<{ url: string; pdf: boolean }[] | null>(null);
  const [fotoMotorista, setFotoMotorista] = useState<string | null>(null);
  // Qual pedido o gestor está escrevendo: devolver para o motorista corrigir ou excluir.
  const [pedido, setPedido] = useState<"rejeitada" | "excluida" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function avaliar(situacao: "aprovada" | "rejeitada" | "excluida") {
    if (situacao !== "aprovada" && !motivo.trim()) {
      setErro(situacao === "rejeitada" ? "Escreva o que o motorista precisa corrigir." : "Escreva o motivo da exclusão.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await avaliarDespesa(d.id, situacao, motivo.trim());
      aoAvaliar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  useEffect(() => {
    const caminho = d.motorista?.foto_caminho;
    if (caminho) linksDasFotosDeUsuarios([caminho]).then((m) => setFotoMotorista(m.get(caminho) || null));
  }, [d]);

  useEffect(() => {
    const caminhos = [...d.comprovante].sort((a, b) => a.ordem - b.ordem).map((c) => c.caminho);
    linksDasFotos(caminhos)
      .then((urls) => setFotos(urls.map((url, i) => ({ url, pdf: caminhos[i].toLowerCase().endsWith(".pdf") }))))
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
        <div className="motorista-detalhe">
          <span className="avatar grande">
            {fotoMotorista ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotoMotorista} alt={d.motorista?.nome ?? ""} />
            ) : (
              iniciais(d.motorista?.nome ?? "?")
            )}
          </span>
          <strong>{d.motorista?.nome}</strong>
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
            <tr>
              <th>Situação</th>
              <td>
                <span className={`selo ${d.situacao}`}>{NOMES_SITUACAO[d.situacao]}</span>
              </td>
            </tr>
            {d.motivo_rejeicao && (
              <tr>
                <th>
                  {d.situacao === "excluida"
                    ? "Motivo da exclusão"
                    : d.situacao === "rejeitada"
                      ? "Pedido ao motorista"
                      : "Último pedido de ajuste"}
                </th>
                <td>{d.motivo_rejeicao}</td>
              </tr>
            )}
          </tbody>
        </table>
        {d.situacao !== "excluida" && (
          <div className="avaliacao">
            {pedido ? (
              <>
                <label>
                  {pedido === "rejeitada" ? "O que o motorista precisa corrigir?" : "Por que esta despesa vai ser excluída?"}
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder={
                      pedido === "rejeitada"
                        ? "Ex.: a foto do cupom está ilegível, tire outra."
                        : "Ex.: despesa lançada duas vezes."
                    }
                  />
                </label>
                <div className="botoes">
                  <button className="botao perigo" onClick={() => avaliar(pedido)} disabled={salvando}>
                    {pedido === "rejeitada" ? "Enviar para o motorista corrigir" : "Excluir e avisar o motorista"}
                  </button>
                  <button className="botao secundario" onClick={() => setPedido(null)} disabled={salvando}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div className="botoes">
                {d.situacao !== "aprovada" && (
                  <button className="botao" onClick={() => avaliar("aprovada")} disabled={salvando}>
                    Aprovar
                  </button>
                )}
                {d.situacao === "pendente" && (
                  <button className="botao perigo" onClick={() => setPedido("rejeitada")} disabled={salvando}>
                    Rejeitar
                  </button>
                )}
                <button className="botao secundario" onClick={() => setPedido("excluida")} disabled={salvando}>
                  Excluir
                </button>
              </div>
            )}
            {erro && <p className="erro">{erro}</p>}
          </div>
        )}
        <div className="fotos">
          {fotos === null && <p>Carregando anexos...</p>}
          {fotos?.length === 0 && <p className="rotulo-suave">Sem anexos.</p>}
          {fotos?.map(({ url, pdf }) =>
            pdf ? (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="botao secundario">
                Abrir arquivo PDF
              </a>
            ) : (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Comprovante" />
              </a>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

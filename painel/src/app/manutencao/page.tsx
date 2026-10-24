"use client";

import { useEffect, useState } from "react";
import type { Veiculo } from "@/lib/dados";
import { dataBr, numero } from "@/lib/formato";
import { supabase } from "@/lib/supabase";

type Item = {
  id: string;
  veiculo_id: string;
  servico: string;
  intervalo_km: number | null;
  intervalo_meses: number | null;
  ultimo_km: number;
  ultima_data: string;
};

type Situacao = "vencida" | "proxima" | "em-dia";

const SERVICOS_SUGERIDOS = ["Troca de óleo", "Filtros", "Pneus", "Freios", "Revisão geral", "Alinhamento e balanceamento"];

// Avisa quando faltar 10% do intervalo (ou 1.000 km / 15 dias, o que for maior).
function calcular(item: Item, kmAtual: number) {
  const faltaKm = item.intervalo_km ? item.ultimo_km + item.intervalo_km - kmAtual : null;
  let proximaData: Date | null = null;
  let faltaDias: number | null = null;
  if (item.intervalo_meses) {
    proximaData = new Date(`${item.ultima_data}T12:00:00`);
    proximaData.setMonth(proximaData.getMonth() + item.intervalo_meses);
    faltaDias = Math.ceil((proximaData.getTime() - Date.now()) / 86_400_000);
  }
  const vencida = (faltaKm !== null && faltaKm <= 0) || (faltaDias !== null && faltaDias <= 0);
  const proxima =
    (faltaKm !== null && item.intervalo_km !== null && faltaKm <= Math.max(item.intervalo_km * 0.1, 1000)) ||
    (faltaDias !== null && item.intervalo_meses !== null && faltaDias <= Math.max(item.intervalo_meses * 3, 15));
  const situacao: Situacao = vencida ? "vencida" : proxima ? "proxima" : "em-dia";
  return { faltaKm, proximaData, faltaDias, situacao };
}

const TEXTO_SITUACAO: Record<Situacao, string> = { vencida: "Vencida", proxima: "Chegando", "em-dia": "Em dia" };
const CLASSE_SITUACAO: Record<Situacao, string> = { vencida: "rejeitada", proxima: "pendente", "em-dia": "aprovada" };
const ORDEM: Record<Situacao, number> = { vencida: 0, proxima: 1, "em-dia": 2 };

export default function Manutencao() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState("");
  const [servico, setServico] = useState("");
  const [intervaloKm, setIntervaloKm] = useState("");
  const [intervaloMeses, setIntervaloMeses] = useState("");
  const [ultimoKm, setUltimoKm] = useState("");

  // Aumenta a cada alteração para recarregar a lista.
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    Promise.all([
      supabase.from("veiculo").select("id, placa, modelo, ano, km_atual, ativo").eq("ativo", true).order("placa"),
      supabase
        .from("manutencao")
        .select("id, veiculo_id, servico, intervalo_km, intervalo_meses, ultimo_km, ultima_data"),
    ]).then(([v, m]) => {
      if (v.error || m.error) return setErro((v.error ?? m.error)!.message);
      setVeiculos(v.data as Veiculo[]);
      setItens(m.data as Item[]);
    });
  }, [versao]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: usuario } = await supabase.from("usuario").select("empresa_id").eq("id", data.user.id).single();
      setEmpresaId(usuario?.empresa_id ?? null);
    });
  }, []);

  const porId = new Map(veiculos.map((v) => [v.id, v]));
  const linhas = itens
    .filter((i) => porId.has(i.veiculo_id))
    .map((i) => ({ item: i, veiculo: porId.get(i.veiculo_id)!, ...calcular(i, porId.get(i.veiculo_id)!.km_atual) }))
    .sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.veiculo.placa.localeCompare(b.veiculo.placa));
  const atencao = linhas.filter((l) => l.situacao !== "em-dia").length;

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const km = intervaloKm ? Number(intervaloKm.replace(/\D/g, "")) : null;
    const meses = intervaloMeses ? Number(intervaloMeses.replace(/\D/g, "")) : null;
    if (!km && !meses) return setErro("Informe a cada quantos km ou a cada quantos meses.");
    const veiculo = porId.get(veiculoId);
    const { error } = await supabase.from("manutencao").insert({
      empresa_id: empresaId,
      veiculo_id: veiculoId,
      servico: servico.trim(),
      intervalo_km: km,
      intervalo_meses: meses,
      // Sem o km da última vez, conta a partir do km atual do veículo.
      ultimo_km: ultimoKm ? Number(ultimoKm.replace(/\D/g, "")) : (veiculo?.km_atual ?? 0),
    });
    if (error) return setErro(error.message);
    setServico("");
    setIntervaloKm("");
    setIntervaloMeses("");
    setUltimoKm("");
    recarregar();
  }

  async function marcarFeita(l: (typeof linhas)[number]) {
    if (!confirm(`Marcar "${l.item.servico}" do ${l.veiculo.placa} como feita hoje, com ${numero(l.veiculo.km_atual)} km?`)) {
      return;
    }
    const hoje = new Date();
    const { error } = await supabase
      .from("manutencao")
      .update({
        ultimo_km: l.veiculo.km_atual,
        ultima_data: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`,
      })
      .eq("id", l.item.id);
    if (error) setErro(error.message);
    else recarregar();
  }

  async function remover(l: (typeof linhas)[number]) {
    if (!confirm(`Tirar "${l.item.servico}" do ${l.veiculo.placa} da lista?`)) return;
    const { error } = await supabase.from("manutencao").delete().eq("id", l.item.id);
    if (error) setErro(error.message);
    else recarregar();
  }

  return (
    <>
      <h1>Manutenção preventiva</h1>
      {atencao > 0 && (
        <p className="cartao" style={{ borderLeft: "4px solid var(--aviso)" }}>
          <b>{atencao}</b> {atencao === 1 ? "manutenção precisa" : "manutenções precisam"} de atenção.
        </p>
      )}
      <form className="cartao filtros" onSubmit={adicionar}>
        <label>
          Veículo
          <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} required>
            <option value="">Escolha</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} {v.modelo ? `- ${v.modelo}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Serviço
          <input
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            list="servicos-sugeridos"
            placeholder="Troca de óleo"
            required
          />
          <datalist id="servicos-sugeridos">
            {SERVICOS_SUGERIDOS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          A cada (km)
          <input value={intervaloKm} onChange={(e) => setIntervaloKm(e.target.value)} inputMode="numeric" placeholder="10000" />
        </label>
        <label>
          ou a cada (meses)
          <input
            value={intervaloMeses}
            onChange={(e) => setIntervaloMeses(e.target.value)}
            inputMode="numeric"
            placeholder="6"
            style={{ minWidth: 80 }}
          />
        </label>
        <label>
          Feita por último com (km)
          <input value={ultimoKm} onChange={(e) => setUltimoKm(e.target.value)} inputMode="numeric" placeholder="km atual" />
        </label>
        <button className="botao" disabled={!empresaId}>
          Adicionar
        </button>
      </form>
      {erro && <p className="erro">{erro}</p>}

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Serviço</th>
              <th>Situação</th>
              <th>Próxima</th>
              <th className="numero">Km atual</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.item.id}>
                <td>{l.veiculo.placa}</td>
                <td>{l.item.servico}</td>
                <td>
                  <span className={`selo ${CLASSE_SITUACAO[l.situacao]}`}>{TEXTO_SITUACAO[l.situacao]}</span>
                </td>
                <td>
                  {l.faltaKm !== null && (
                    <div>
                      {numero(l.item.ultimo_km + l.item.intervalo_km!)} km (
                      {l.faltaKm > 0 ? `faltam ${numero(l.faltaKm)}` : `passou ${numero(-l.faltaKm)}`})
                    </div>
                  )}
                  {l.proximaData && (
                    <div>
                      {dataBr(l.proximaData.toISOString().slice(0, 10))} (
                      {l.faltaDias! > 0 ? `faltam ${l.faltaDias} dias` : `venceu há ${-l.faltaDias!} dias`})
                    </div>
                  )}
                </td>
                <td className="numero">{numero(l.veiculo.km_atual)}</td>
                <td className="acoes">
                  <button className="botao secundario" onClick={() => marcarFeita(l)}>
                    Marcar como feita
                  </button>
                  <button className="botao secundario" onClick={() => remover(l)}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="rotulo-suave">
                  Nenhuma manutenção cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="rotulo-suave">
          O km atual de cada veículo vem do maior odômetro lançado pelos motoristas. Quando o serviço for feito,
          clique em Marcar como feita: a contagem recomeça a partir do km e da data de hoje.
        </p>
      </div>
    </>
  );
}

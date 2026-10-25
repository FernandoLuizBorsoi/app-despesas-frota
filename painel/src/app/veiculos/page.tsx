"use client";

import { useEffect, useState } from "react";
import { excluirDeVez, ocultar, type Veiculo } from "@/lib/dados";
import { numero } from "@/lib/formato";
import { supabase } from "@/lib/supabase";

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [km, setKm] = useState("");
  const [souAdmin, setSouAdmin] = useState(false);

  // Aumenta a cada alteração para recarregar a lista.
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    supabase
      .from("veiculo")
      .select("id, placa, modelo, ano, km_atual, ativo, oculto")
      .order("ativo", { ascending: false })
      .order("placa")
      .then(({ data, error }) => (error ? setErro(error.message) : setVeiculos(data as Veiculo[])));
  }, [versao]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: usuario } = await supabase.from("usuario").select("empresa_id, perfil").eq("id", data.user.id).single();
      setEmpresaId(usuario?.empresa_id ?? null);
      setSouAdmin(usuario?.perfil === "admin");
    });
  }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const placaLimpa = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placaLimpa)) {
      setErro("Placa inválida. Use o formato ABC1234 ou ABC1D23.");
      return;
    }
    const { error } = await supabase.from("veiculo").insert({
      empresa_id: empresaId,
      placa: placaLimpa,
      modelo: modelo.trim() || null,
      ano: ano ? Number(ano) : null,
      km_atual: km ? Number(km.replace(/\D/g, "")) : 0,
    });
    if (error) {
      setErro(error.code === "23505" ? "Essa placa já está cadastrada." : error.message);
      return;
    }
    setPlaca("");
    setModelo("");
    setAno("");
    setKm("");
    recarregar();
  }

  async function alternarOculto(v: Veiculo) {
    const pergunta = v.oculto
      ? `Mostrar ${v.placa} de novo para os gestores? Ele continua inativo até alguém clicar em Reativar.`
      : `Ocultar ${v.placa}? Ele some do app e da visão dos gestores, junto com as despesas dele. Só você continua vendo.`;
    if (!confirm(pergunta)) return;
    try {
      await ocultar("veiculo", v.id, !v.oculto);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
    }
  }

  async function excluir(v: Veiculo) {
    if (!confirm(`Excluir ${v.placa} DE VEZ? Todas as despesas desse veículo também serão apagadas. Isso não tem volta.`)) return;
    try {
      await excluirDeVez("veiculo", v.id);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  async function alternarAtivo(v: Veiculo) {
    const { error } = await supabase.from("veiculo").update({ ativo: !v.ativo }).eq("id", v.id);
    if (error) setErro(error.message);
    else recarregar();
  }

  return (
    <>
      <h1>Veículos</h1>
      <form className="cartao filtros" onSubmit={adicionar}>
        <label>
          Placa
          <input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC1D23" required />
        </label>
        <label>
          Modelo
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="VW Delivery" />
        </label>
        <label>
          Ano
          <input value={ano} onChange={(e) => setAno(e.target.value)} inputMode="numeric" style={{ minWidth: 80 }} />
        </label>
        <label>
          Km atual
          <input value={km} onChange={(e) => setKm(e.target.value)} inputMode="numeric" />
        </label>
        <button className="botao" disabled={!empresaId}>
          Adicionar veículo
        </button>
      </form>
      {erro && <p className="erro">{erro}</p>}

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Ano</th>
              <th className="numero">Km atual</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => (
              <tr key={v.id} style={v.ativo ? undefined : { color: "var(--suave)" }}>
                <td>{v.placa}</td>
                <td>{v.modelo}</td>
                <td>{v.ano}</td>
                <td className="numero">{numero(v.km_atual)}</td>
                <td>{v.oculto ? "Oculto (só você vê)" : v.ativo ? "Ativo" : "Inativo"}</td>
                <td className="acoes">
                  <button className="botao secundario" onClick={() => alternarAtivo(v)}>
                    {v.ativo ? "Desativar" : "Reativar"}
                  </button>
                  {souAdmin && (
                    <>
                      <button className="botao secundario" onClick={() => alternarOculto(v)}>
                        {v.oculto ? "Mostrar" : "Ocultar"}
                      </button>
                      <button className="botao perigo" onClick={() => excluir(v)}>
                        Excluir
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rotulo-suave">
          Veículos inativos não aparecem mais no app dos motoristas, mas as despesas antigas continuam nos relatórios.
        </p>
      </div>
    </>
  );
}

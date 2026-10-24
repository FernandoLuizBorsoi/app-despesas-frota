"use client";

import { useEffect, useState } from "react";
import { carregarEmpresa, linkDaLogo, trocarLogo, type Empresa } from "@/lib/dados";

const TAMANHO_MAXIMO = 2 * 1024 * 1024;

export default function Configuracoes() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarEmpresa().then(setEmpresa);
  }, []);

  async function salvar(arquivo: File | null) {
    if (!empresa) return;
    if (arquivo && !["image/png", "image/jpeg"].includes(arquivo.type)) {
      setErro("Use uma imagem PNG ou JPG.");
      return;
    }
    if (arquivo && arquivo.size > TAMANHO_MAXIMO) {
      setErro("A imagem é muito grande. Use uma de até 2 MB.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await trocarLogo(empresa, arquivo);
      // Recarrega para a logo nova aparecer também no topo do painel.
      window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  if (!empresa) return <p>Carregando...</p>;
  const logo = linkDaLogo(empresa.logo_caminho);

  return (
    <>
      <h1>Configurações</h1>
      <div className="cartao" style={{ maxWidth: 560 }}>
        <h2>Logo da empresa</h2>
        <p className="rotulo-suave">
          Aparece no topo do painel e no app dos motoristas. Use uma imagem PNG ou JPG de até 2 MB, de preferência
          com fundo transparente ou branco.
        </p>
        <div className="logo-previa">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo atual" />
          ) : (
            <span className="rotulo-suave">Nenhuma logo enviada ainda.</span>
          )}
        </div>
        <div className="botoes">
          <label className="botao" style={{ color: "#fff", cursor: "pointer" }}>
            {salvando ? "Enviando..." : logo ? "Trocar logo" : "Enviar logo"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              hidden
              disabled={salvando}
              onChange={(e) => e.target.files?.[0] && salvar(e.target.files[0])}
            />
          </label>
          {logo && (
            <button className="botao secundario" onClick={() => salvar(null)} disabled={salvando}>
              Remover logo
            </button>
          )}
        </div>
        {erro && <p className="erro">{erro}</p>}
      </div>
    </>
  );
}

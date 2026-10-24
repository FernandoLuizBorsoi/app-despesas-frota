"use client";

import { useEffect, useState } from "react";
import { carregarEmpresa, criarEmpresa, listarEmpresas, trocarEmpresa } from "@/lib/dados";

type Empresa = { id: string; nome: string };

// Só para o administrador geral: lista as empresas, cria novas e entra em uma delas.
export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [atual, setAtual] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarEmpresas()
      .then(setEmpresas)
      .catch((e) => setErro(e.message));
    carregarEmpresa().then((e) => setAtual(e?.id ?? null));
  }, []);

  async function entrar(id: string, destino = "/despesas") {
    try {
      await trocarEmpresa(id);
      window.location.href = destino;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível trocar de empresa.");
    }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const id = await criarEmpresa(nome.trim());
      // Entra direto na empresa nova para cadastrar o primeiro gestor.
      await entrar(id, "/motoristas");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a empresa.");
      setSalvando(false);
    }
  }

  if (empresas === null && !erro) return <p>Carregando...</p>;

  return (
    <>
      <h1>Empresas</h1>
      <form className="cartao filtros" onSubmit={adicionar}>
        <label style={{ flex: 1 }}>
          Nome da nova empresa
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Transportes Exemplo Ltda" required />
        </label>
        <button className="botao" disabled={salvando || !nome.trim()}>
          {salvando ? "Criando..." : "Criar empresa"}
        </button>
      </form>
      {erro && <p className="erro">{erro}</p>}

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(empresas ?? []).map((emp) => (
              <tr key={emp.id}>
                <td>{emp.nome}</td>
                <td className="acoes">
                  {emp.id === atual ? (
                    <span className="rotulo-suave">Você está nesta</span>
                  ) : (
                    <button className="botao secundario" onClick={() => entrar(emp.id)}>
                      Entrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rotulo-suave">
          Ao criar uma empresa você entra nela e vai para Motoristas e gestores: cadastre ali o primeiro gestor
          (Perfil &quot;Gestor&quot;, com e-mail e senha). Cada gestor só vê a própria empresa. Você troca de empresa
          aqui ou na caixa do topo do painel. Toda empresa nova já começa com as 8 categorias padrão.
        </p>
      </div>
    </>
  );
}

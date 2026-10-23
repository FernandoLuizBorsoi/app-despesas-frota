"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Pessoa = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  perfil: "motorista" | "gestor" | "admin";
  ativo: boolean;
};

const ROTULO_PERFIL = { motorista: "Motorista", gestor: "Gestor", admin: "Admin" };

function formatarCpf(cpf: string | null): string {
  if (!cpf || cpf.length !== 11) return cpf ?? "";
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export default function Motoristas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState<"motorista" | "gestor">("motorista");

  // Aumenta a cada alteração para recarregar a lista.
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((v) => v + 1);

  useEffect(() => {
    supabase
      .from("usuario")
      .select("id, nome, cpf, telefone, perfil, ativo")
      .order("ativo", { ascending: false })
      .order("nome")
      .then(({ data, error }) => (error ? setErro(error.message) : setPessoas(data as Pessoa[])));
  }, [versao]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: { nome, cpf, email, senha, telefone, perfil },
    });
    setSalvando(false);
    if (error) {
      // A função devolve a mensagem em português no corpo da resposta.
      const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
      setErro(corpo?.erro ?? "Não foi possível cadastrar. Tente de novo.");
      return;
    }
    if (data?.erro) {
      setErro(data.erro);
      return;
    }
    const numeros = cpf.replace(/\D/g, "");
    const qualSenha = senha ? "a senha escolhida" : `a senha ${numeros.slice(0, 6)}`;
    setAviso(
      perfil === "gestor"
        ? `${nome} cadastrado. Ele entra no painel com o e-mail ${email.trim().toLowerCase()} e ${qualSenha}.`
        : `${nome} cadastrado. Ele entra no app com o CPF ${formatarCpf(numeros)} e ${qualSenha}.`,
    );
    setNome("");
    setCpf("");
    setEmail("");
    setSenha("");
    setTelefone("");
    setPerfil("motorista");
    recarregar();
  }

  async function senhaPadrao(p: Pessoa) {
    const padrao = (p.cpf ?? "").slice(0, 6);
    if (!confirm(`Gerar nova senha para ${p.nome}? A senha vai ser ${padrao} (6 primeiros números do CPF).`)) return;
    setErro(null);
    setAviso(null);
    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: { acao: "senha-padrao", id: p.id },
    });
    if (error || data?.erro) {
      const corpo = error ? await (error as { context?: Response }).context?.json?.().catch(() => null) : data;
      setErro(corpo?.erro ?? "Não foi possível trocar a senha. Tente de novo.");
      return;
    }
    setAviso(`Nova senha de ${p.nome}: ${padrao}.`);
  }

  async function alternarAtivo(p: Pessoa) {
    const { error } = await supabase.from("usuario").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) setErro(error.message);
    else recarregar();
  }

  return (
    <>
      <h1>Motoristas</h1>
      <form className="cartao filtros" onSubmit={adicionar}>
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João da Silva" required />
        </label>
        <label>
          CPF (para entrar no app)
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" required />
        </label>
        {perfil === "gestor" && (
          <label>
            E-mail (para entrar no painel)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
        )}
        <label>
          Senha
          <input
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            minLength={6}
            placeholder="em branco: 6 primeiros números do CPF"
          />
        </label>
        <label>
          Telefone
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />
        </label>
        <label>
          Perfil
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as "motorista" | "gestor")}>
            <option value="motorista">Motorista</option>
            <option value="gestor">Gestor</option>
          </select>
        </label>
        <button className="botao" disabled={salvando}>
          {salvando ? "Cadastrando..." : "Cadastrar"}
        </button>
      </form>
      {erro && <p className="erro">{erro}</p>}
      {aviso && <p>{aviso}</p>}

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Telefone</th>
              <th>Perfil</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.id} style={p.ativo ? undefined : { color: "var(--suave)" }}>
                <td>{p.nome}</td>
                <td>{formatarCpf(p.cpf)}</td>
                <td>{p.telefone}</td>
                <td>{ROTULO_PERFIL[p.perfil]}</td>
                <td>{p.ativo ? "Ativo" : "Inativo"}</td>
                <td className="acoes">
                  {p.cpf && p.perfil === "motorista" && (
                    <button className="botao secundario" onClick={() => senhaPadrao(p)}>
                      Gerar nova senha
                    </button>
                  )}
                  <button className="botao secundario" onClick={() => alternarAtivo(p)}>
                    {p.ativo ? "Desativar" : "Reativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rotulo-suave">
          Quem for desativado não consegue mais lançar despesas, mas o histórico continua nos relatórios. Se um
          motorista esquecer a senha, use Gerar nova senha: ela passa a ser os 6 primeiros números do CPF.
        </p>
      </div>
    </>
  );
}

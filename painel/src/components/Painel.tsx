"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { carregarEmpresa, linkDaLogo, listarEmpresas, trocarEmpresa } from "@/lib/dados";
import { emailDoLogin } from "@/lib/login";
import { supabase } from "@/lib/supabase";

const MENU = [
  { href: "/despesas", rotulo: "Despesas" },
  { href: "/analise", rotulo: "Análise" },
  { href: "/relatorios", rotulo: "Relatórios" },
  { href: "/veiculos", rotulo: "Veículos" },
  { href: "/motoristas", rotulo: "Motoristas" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

// Só o administrador geral vê.
const MENU_ADMIN = [{ href: "/empresas", rotulo: "Empresas" }];

type Estado =
  | { tipo: "carregando" }
  | { tipo: "deslogado" }
  | { tipo: "sem-permissao" }
  | { tipo: "bloqueado" }
  | {
      tipo: "ok";
      nome: string;
      empresa: string;
      empresaId: string | null;
      logo: string | null;
      marcaDagua: boolean;
      // Preenchida só para o administrador geral.
      empresas: { id: string; nome: string; ativa: boolean }[] | null;
    };

// Envolve todas as páginas (menos /app): exige login e perfil de gestor ou admin.
export function Painel({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    async function verificar(sessao: Session | null) {
      if (!sessao) return setEstado({ tipo: "deslogado" });
      const { data } = await supabase.from("usuario").select("nome, perfil").eq("id", sessao.user.id).single();
      if (!data || data.perfil === "motorista") return setEstado({ tipo: "sem-permissao" });
      const empresa = await carregarEmpresa();
      // Sem empresa visível: o próprio acesso ou a empresa foi desativada.
      if (!empresa && data.perfil !== "admin") return setEstado({ tipo: "bloqueado" });
      const empresas = data.perfil === "admin" ? await listarEmpresas().catch(() => null) : null;
      setEstado({
        tipo: "ok",
        nome: data.nome,
        empresa: empresa?.nome ?? "Despesas da Frota",
        empresaId: empresa?.id ?? null,
        logo: linkDaLogo(empresa?.logo_caminho ?? null),
        marcaDagua: Boolean(empresa?.marca_dagua),
        empresas,
      });
    }
    supabase.auth.getSession().then(({ data }) => verificar(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sessao) => {
      verificar(sessao);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // A página de baixar o app é aberta pelos motoristas, sem login.
  if (caminho === "/app") return <>{children}</>;
  if (estado.tipo === "carregando") return <div className="centro">Carregando...</div>;
  if (estado.tipo === "deslogado") return <Login />;
  if (estado.tipo === "sem-permissao" || estado.tipo === "bloqueado") {
    return (
      <div className="centro">
        <div className="login">
          <p>
            {estado.tipo === "bloqueado"
              ? "Seu acesso está bloqueado. Fale com o administrador do sistema."
              : "Este painel é só para gestores. Motoristas usam o app no celular."}
          </p>
          <button className="botao secundario" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="topo">
        <span className="marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {estado.logo && <img src={estado.logo} alt="" />}
          {estado.empresas ? (
            <select
              className="seletor-empresa"
              value={estado.empresaId ?? ""}
              title="Empresa que você está vendo"
              onChange={async (e) => {
                await trocarEmpresa(e.target.value);
                window.location.reload();
              }}
            >
              {estado.empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                  {emp.ativa ? "" : " (desativada)"}
                </option>
              ))}
            </select>
          ) : (
            estado.empresa
          )}
        </span>
        <nav>
          {[...MENU, ...(estado.empresas ? MENU_ADMIN : [])].map((m) => (
            <Link key={m.href} href={m.href} className={caminho.startsWith(m.href) ? "ativo" : ""}>
              {m.rotulo}
            </Link>
          ))}
        </nav>
        <span>{estado.nome}</span>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main>{children}</main>
      {estado.marcaDagua && estado.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="marca-dagua" src={estado.logo} alt="" aria-hidden />
      )}
    </>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoLogin(email), password: senha });
    setEntrando(false);
    if (error) setErro("E-mail/CPF ou senha incorretos.");
  }

  return (
    <div className="centro">
      <form className="login cartao" onSubmit={entrar}>
        <h1>Despesas da Frota</h1>
        <label>
          E-mail ou CPF
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {erro && <span className="erro">{erro}</span>}
        <button className="botao" disabled={entrando}>
          {entrando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

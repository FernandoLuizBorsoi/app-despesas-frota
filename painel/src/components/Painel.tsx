"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { carregarEmpresa, linkDaLogo } from "@/lib/dados";
import { emailDoLogin } from "@/lib/login";
import { supabase } from "@/lib/supabase";

const MENU = [
  { href: "/despesas", rotulo: "Despesas" },
  { href: "/relatorios", rotulo: "Relatórios" },
  { href: "/veiculos", rotulo: "Veículos" },
  { href: "/motoristas", rotulo: "Motoristas" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

type Estado =
  | { tipo: "carregando" }
  | { tipo: "deslogado" }
  | { tipo: "sem-permissao" }
  | { tipo: "ok"; nome: string; logo: string | null };

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
      setEstado({ tipo: "ok", nome: data.nome, logo: linkDaLogo(empresa?.logo_caminho ?? null) });
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
  if (estado.tipo === "sem-permissao") {
    return (
      <div className="centro">
        <div className="login">
          <p>Este painel é só para gestores. Motoristas usam o app no celular.</p>
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
          Despesas da Frota
        </span>
        <nav>
          {MENU.map((m) => (
            <Link key={m.href} href={m.href} className={caminho.startsWith(m.href) ? "ativo" : ""}>
              {m.rotulo}
            </Link>
          ))}
        </nav>
        <span>{estado.nome}</span>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>
      <main>{children}</main>
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

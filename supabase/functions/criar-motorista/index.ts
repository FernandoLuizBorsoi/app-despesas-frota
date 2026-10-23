// Cria o login de um motorista (ou gestor) a partir do painel.
// Só um gestor ou admin logado pode chamar; o novo usuário entra na empresa de quem chamou.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Motoristas entram com o CPF; o login do Supabase usa um e-mail no domínio reservado
// ".invalid" (nunca recebe mensagens). Mesmo formato de painel/src/lib/login.ts.
const DOMINIO_CPF = "cpf.invalid";

function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

function resposta(status: number, corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta(405, { erro: "Método não permitido." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quemChama } = await admin.auth.getUser(token);
  if (!quemChama.user) return resposta(401, { erro: "Faça login novamente." });

  const { data: gestor } = await admin
    .from("usuario")
    .select("empresa_id, perfil, ativo")
    .eq("id", quemChama.user.id)
    .single();
  if (!gestor || !gestor.ativo || gestor.perfil === "motorista") {
    return resposta(403, { erro: "Só gestores podem cadastrar pessoas." });
  }

  let corpo: { nome?: string; cpf?: string; email?: string; senha?: string; perfil?: string; telefone?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: "Dados inválidos." });
  }
  const nome = corpo.nome?.trim();
  const cpf = (corpo.cpf ?? "").replace(/\D/g, "");
  const senha = corpo.senha ?? "";
  const perfil = corpo.perfil === "gestor" ? "gestor" : "motorista";
  if (!nome) return resposta(400, { erro: "Informe o nome." });
  if (!cpfValido(cpf)) return resposta(400, { erro: "CPF inválido. Confira os números." });
  // Gestores entram no painel com e-mail; motoristas, só com o CPF.
  const email = perfil === "gestor" ? corpo.email?.trim().toLowerCase() : `${cpf}@${DOMINIO_CPF}`;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta(400, { erro: "E-mail inválido." });

  const { data: mesmoCpf } = await admin
    .from("usuario")
    .select("id")
    .eq("empresa_id", gestor.empresa_id)
    .eq("cpf", cpf)
    .maybeSingle();
  if (mesmoCpf) return resposta(400, { erro: "Esse CPF já está cadastrado." });
  if (senha.length < 6) return resposta(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (erroCriar || !criado.user) {
    const jaExiste = erroCriar?.message.toLowerCase().includes("already");
    const qual = perfil === "gestor" ? "e-mail" : "CPF";
    return resposta(400, { erro: jaExiste ? `Esse ${qual} já tem login.` : (erroCriar?.message ?? "Erro ao criar login.") });
  }

  const { error: erroUsuario } = await admin.from("usuario").insert({
    id: criado.user.id,
    empresa_id: gestor.empresa_id,
    nome,
    cpf,
    perfil,
    telefone: corpo.telefone?.trim() || null,
  });
  if (erroUsuario) {
    // Sem o cadastro na empresa o login não serve para nada: desfaz.
    await admin.auth.admin.deleteUser(criado.user.id);
    return resposta(500, { erro: erroUsuario.message });
  }

  return resposta(200, { id: criado.user.id });
});

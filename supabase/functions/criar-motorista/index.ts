// Cria o login de um motorista (ou gestor) a partir do painel.
// Só um gestor ou admin logado pode chamar; o novo usuário entra na empresa de quem chamou.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let corpo: { nome?: string; email?: string; senha?: string; perfil?: string; telefone?: string };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: "Dados inválidos." });
  }
  const nome = corpo.nome?.trim();
  const email = corpo.email?.trim().toLowerCase();
  const senha = corpo.senha ?? "";
  const perfil = corpo.perfil === "gestor" ? "gestor" : "motorista";
  if (!nome) return resposta(400, { erro: "Informe o nome." });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta(400, { erro: "E-mail inválido." });
  if (senha.length < 6) return resposta(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (erroCriar || !criado.user) {
    const jaExiste = erroCriar?.message.toLowerCase().includes("already");
    return resposta(400, { erro: jaExiste ? "Esse e-mail já tem login." : (erroCriar?.message ?? "Erro ao criar login.") });
  }

  const { error: erroUsuario } = await admin.from("usuario").insert({
    id: criado.user.id,
    empresa_id: gestor.empresa_id,
    nome,
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

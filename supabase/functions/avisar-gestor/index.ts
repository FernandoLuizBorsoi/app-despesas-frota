// Manda e-mail aos gestores quando chega uma despesa nova ou corrigida.
// É chamada pelo próprio banco (gatilho despesa_avisar_gestor), só com o id da despesa.
// Não precisa de login: só avisa sobre despesa que acabou de chegar e ainda não foi avisada,
// então chamar de novo não manda e-mail repetido.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PAINEL = "https://app-despesas-frota-gzo8.vercel.app/despesas";
const REMETENTE = "Despesas da Frota <onboarding@resend.dev>";
const JANELA_MINUTOS = 10;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Despesa = {
  id: string;
  empresa_id: string;
  data: string;
  valor: number;
  situacao: string;
  motivo_rejeicao: string | null;
  observacao: string | null;
  km_odometro: number | null;
  atualizado_em: string;
  motorista: { nome: string } | null;
  veiculo: { placa: string } | null;
  categoria: { nome: string } | null;
};

function resposta(status: number, corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const escapar = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function montarEmail(d: Despesa, corrigida: boolean) {
  const motorista = d.motorista?.nome ?? "Motorista";
  const assunto = `${corrigida ? "Despesa corrigida" : "Nova despesa"}: ${motorista} · ${reais(Number(d.valor))}`;
  const linhas: [string, string][] = [
    ["Motorista", motorista],
    ["Veículo", d.veiculo?.placa ?? ""],
    ["Categoria", d.categoria?.nome ?? ""],
    ["Data", dataBr(d.data)],
    ["Valor", reais(Number(d.valor))],
  ];
  if (d.km_odometro !== null) linhas.push(["Km", d.km_odometro.toLocaleString("pt-BR")]);
  if (d.observacao) linhas.push(["Observação", d.observacao]);
  if (corrigida && d.motivo_rejeicao) linhas.push(["Você tinha pedido", d.motivo_rejeicao]);

  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1b1f24">
      <p>${corrigida ? "Uma despesa que você devolveu foi corrigida" : "Chegou uma despesa nova"} e aguarda aprovação.</p>
      <table cellpadding="6" style="border-collapse: collapse">
        ${linhas.map(([r, v]) => `<tr><td style="color:#5e6773">${r}</td><td><b>${escapar(v)}</b></td></tr>`).join("")}
      </table>
      <p><a href="${PAINEL}" style="background:#1f5fad;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Abrir o painel para aprovar</a></p>
    </div>`;
  return { assunto, html };
}

Deno.serve(async (req) => {
  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) return resposta(200, { ok: false, motivo: "RESEND_API_KEY não configurada" });

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return resposta(400, { erro: "id obrigatório" });

  const { data, error } = await supabase
    .from("despesa")
    .select(
      "id, empresa_id, data, valor, situacao, motivo_rejeicao, observacao, km_odometro, atualizado_em," +
        " motorista:usuario!despesa_motorista_id_fkey(nome), veiculo(placa), categoria(nome)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return resposta(500, { erro: error.message });
  const d = data as unknown as Despesa | null;
  if (!d || d.situacao !== "pendente") return resposta(200, { ok: false, motivo: "nada a avisar" });
  if (Date.now() - new Date(d.atualizado_em).getTime() > JANELA_MINUTOS * 60_000) {
    return resposta(200, { ok: false, motivo: "despesa antiga" });
  }

  // Marca antes de mandar: se outra chamada chegar junto, só uma passa daqui.
  const { error: jaAvisado } = await supabase
    .from("aviso_despesa")
    .insert({ despesa_id: d.id, versao: d.atualizado_em });
  if (jaAvisado) return resposta(200, { ok: false, motivo: "já avisado" });

  // Só despesa que o gestor já devolveu tem motivo de rejeição.
  const { assunto, html } = montarEmail(d, Boolean(d.motivo_rejeicao));

  const { data: gestores } = await supabase
    .from("usuario")
    .select("id")
    .eq("empresa_id", d.empresa_id)
    .in("perfil", ["gestor", "admin"])
    .eq("ativo", true);

  const enviados: string[] = [];
  const falhas: string[] = [];
  for (const g of gestores ?? []) {
    const { data: u } = await supabase.auth.admin.getUserById(g.id);
    const email = u.user?.email;
    if (!email || email.endsWith(".invalid")) continue;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMETENTE, to: [email], subject: assunto, html }),
    });
    if (r.ok) enviados.push(email);
    else falhas.push(`${email}: ${r.status} ${await r.text()}`);
  }
  if (falhas.length) console.error("Falha ao enviar e-mail", falhas);
  return resposta(200, { ok: true, enviados: enviados.length, falhas: falhas.length });
});

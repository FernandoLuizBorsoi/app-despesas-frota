import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !chaveAnon) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local");
}

export const supabase = createClient(url, chaveAnon);

export const BUCKET_COMPROVANTES = "comprovantes";

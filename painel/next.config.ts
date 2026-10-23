import type { NextConfig } from "next";

// O painel é só HTML + JavaScript: os dados vêm direto do Supabase pelo navegador,
// protegidos pelas regras de acesso do banco. Pode ser hospedado em qualquer lugar.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;

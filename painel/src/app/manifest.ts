import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Permite "Adicionar à tela inicial" no celular ou computador, com o ícone do caminhão.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Despesas da Frota",
    short_name: "Despesas",
    description: "Painel do gestor para acompanhar as despesas dos motoristas",
    start_url: "/despesas",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#1f5fad",
    lang: "pt-BR",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}

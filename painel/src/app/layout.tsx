import type { Metadata } from "next";
import { Painel } from "@/components/Painel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Despesas da Frota",
  description: "Painel do gestor para acompanhar as despesas dos motoristas",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <Painel>{children}</Painel>
      </body>
    </html>
  );
}

"use client";

import { useEffect, useState } from "react";

// O APK fica na última "Release" do GitHub (grátis), não no Vercel: um arquivo de 100 MB
// em cada publicação do painel gastava o limite gratuito. Qualquer nome de arquivo .apk serve.
const RELEASES = "https://github.com/FernandoLuizBorsoi/app-despesas-frota/releases/latest";
const API = "https://api.github.com/repos/FernandoLuizBorsoi/app-despesas-frota/releases/latest";

export function BotaoBaixar() {
  const [link, setLink] = useState(RELEASES);

  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then((r: { assets?: { name: string; browser_download_url: string }[] }) => {
        const apk = r.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
        if (apk) setLink(apk.browser_download_url);
      })
      .catch(() => {});
  }, []);

  return (
    <a className="botao-grande" href={link}>
      Baixar o app
    </a>
  );
}

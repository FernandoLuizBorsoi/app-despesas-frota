"use client";

import { useEffect, useState } from "react";
import { buscarDespesas, type Despesa, type Filtros } from "./dados";

type Resultado = { chave: string; despesas: Despesa[]; erro: string | null };

// Busca as despesas sempre que os filtros mudam; "carregando" vale enquanto
// o resultado na tela ainda é de outros filtros.
export function useDespesas(filtros: Filtros) {
  const chave = JSON.stringify(filtros);
  const [resultado, setResultado] = useState<Resultado>({ chave: "", despesas: [], erro: null });

  useEffect(() => {
    let atual = true;
    const f = JSON.parse(chave) as Filtros;
    buscarDespesas(f)
      .then((despesas) => atual && setResultado({ chave, despesas, erro: null }))
      .catch((e: Error) => atual && setResultado({ chave, despesas: [], erro: e.message }));
    return () => {
      atual = false;
    };
  }, [chave]);

  return { despesas: resultado.despesas, erro: resultado.erro, carregando: resultado.chave !== chave };
}

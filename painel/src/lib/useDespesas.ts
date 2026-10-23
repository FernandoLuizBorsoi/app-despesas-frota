"use client";

import { useCallback, useEffect, useState } from "react";
import { buscarDespesas, type Despesa, type Filtros } from "./dados";

type Resultado = { chave: string; despesas: Despesa[]; erro: string | null };

// Busca as despesas sempre que os filtros mudam; "carregando" vale enquanto
// o resultado na tela ainda é de outros filtros.
export function useDespesas(filtros: Filtros) {
  const [versao, setVersao] = useState(0);
  const chave = JSON.stringify({ ...filtros, versao });
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

  // Busca de novo com os mesmos filtros, por exemplo depois de aprovar uma despesa.
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return {
    despesas: resultado.despesas,
    erro: resultado.erro,
    carregando: resultado.chave !== chave,
    recarregar,
  };
}

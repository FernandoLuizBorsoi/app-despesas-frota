"use client";

import { useEffect, useState } from "react";
import { carregarOpcoes, hoje, NOMES_SITUACAO, primeiroDiaDoMes, type Filtros, type Opcao } from "@/lib/dados";

export const FILTROS_INICIAIS: Filtros = {
  de: primeiroDiaDoMes(),
  ate: hoje(),
  motoristaId: "",
  veiculoId: "",
  categoriaId: "",
  situacao: "",
};

const SITUACOES: Opcao[] = Object.entries(NOMES_SITUACAO).map(([id, nome]) => ({ id, nome }));

export function FiltrosDespesas(props: {
  filtros: Filtros;
  aoMudar: (f: Filtros) => void;
  children?: React.ReactNode;
}) {
  const [opcoes, setOpcoes] = useState<{ motoristas: Opcao[]; veiculos: Opcao[]; categorias: Opcao[] }>({
    motoristas: [],
    veiculos: [],
    categorias: [],
  });

  useEffect(() => {
    carregarOpcoes().then(setOpcoes);
  }, []);

  const { filtros, aoMudar } = props;
  const mudar = (campo: keyof Filtros) => (e: { target: { value: string } }) =>
    aoMudar({ ...filtros, [campo]: e.target.value });

  const selecao = (rotulo: string, campo: keyof Filtros, lista: Opcao[]) => (
    <label>
      {rotulo}
      <select value={filtros[campo]} onChange={mudar(campo)}>
        <option value="">Todos</option>
        {lista.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="cartao filtros">
      <label>
        De
        <input type="date" value={filtros.de} onChange={mudar("de")} />
      </label>
      <label>
        Até
        <input type="date" value={filtros.ate} onChange={mudar("ate")} />
      </label>
      {selecao("Motorista", "motoristaId", opcoes.motoristas)}
      {selecao("Veículo", "veiculoId", opcoes.veiculos)}
      {selecao("Categoria", "categoriaId", opcoes.categorias)}
      {selecao("Situação", "situacao", SITUACOES)}
      {props.children}
    </div>
  );
}

export type Perfil = {
  id: string;
  empresa_id: string;
  nome: string;
  perfil: 'motorista' | 'gestor' | 'admin';
};

export type Veiculo = {
  id: string;
  placa: string;
  modelo: string | null;
  km_atual: number;
};

export type Categoria = {
  id: string;
  nome: string;
  exige_km: boolean;
  exige_litros: boolean;
};

export const FORMAS_PAGAMENTO = ['Cartão da empresa', 'Dinheiro', 'Pix', 'Cartão próprio'] as const;

// Despesa como fica guardada no celular até ser enviada.
export type DespesaLocal = {
  id: string;
  veiculo_id: string;
  categoria_id: string;
  data: string; // AAAA-MM-DD
  valor_centavos: number;
  km_odometro: number | null;
  litros: number | null;
  forma_pagamento: string | null;
  observacao: string | null;
  fotos: string[]; // caminhos locais das fotos já compactadas
  enviada: boolean;
  erro_envio: string | null;
  criado_em: string;
};

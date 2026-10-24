// Banco no próprio celular: guarda despesas até que haja internet para enviá-las,
// e uma cópia de veículos e categorias para o app funcionar offline.
import * as SQLite from 'expo-sqlite';
import type { Categoria, DespesaLocal, Perfil, Veiculo } from './tipos';

const db = SQLite.openDatabaseSync('despesas.db');

db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS despesa (
    id TEXT PRIMARY KEY NOT NULL,
    veiculo_id TEXT NOT NULL,
    categoria_id TEXT NOT NULL,
    data TEXT NOT NULL,
    valor_centavos INTEGER NOT NULL,
    km_odometro INTEGER,
    litros REAL,
    forma_pagamento TEXT,
    observacao TEXT,
    fotos TEXT NOT NULL,
    enviada INTEGER NOT NULL DEFAULT 0,
    erro_envio TEXT,
    criado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cache (
    chave TEXT PRIMARY KEY NOT NULL,
    valor TEXT NOT NULL
  );
`);

type LinhaDespesa = Omit<DespesaLocal, 'fotos' | 'enviada'> & { fotos: string; enviada: number };

function deLinha(l: LinhaDespesa): DespesaLocal {
  return { ...l, fotos: JSON.parse(l.fotos), enviada: l.enviada === 1 };
}

export async function salvarDespesa(d: DespesaLocal): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO despesa
      (id, veiculo_id, categoria_id, data, valor_centavos, km_odometro, litros,
       forma_pagamento, observacao, fotos, enviada, erro_envio, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.id, d.veiculo_id, d.categoria_id, d.data, d.valor_centavos, d.km_odometro, d.litros,
    d.forma_pagamento, d.observacao, JSON.stringify(d.fotos), d.enviada ? 1 : 0, d.erro_envio,
    d.criado_em,
  );
}

export async function listarDespesas(): Promise<DespesaLocal[]> {
  const linhas = await db.getAllAsync<LinhaDespesa>(
    'SELECT * FROM despesa ORDER BY data DESC, criado_em DESC LIMIT 200',
  );
  return linhas.map(deLinha);
}

export async function listarPendentes(): Promise<DespesaLocal[]> {
  const linhas = await db.getAllAsync<LinhaDespesa>(
    'SELECT * FROM despesa WHERE enviada = 0 ORDER BY criado_em',
  );
  return linhas.map(deLinha);
}

export async function marcarEnviada(id: string): Promise<void> {
  await db.runAsync('UPDATE despesa SET enviada = 1, erro_envio = NULL WHERE id = ?', id);
}

export async function marcarErro(id: string, erro: string): Promise<void> {
  await db.runAsync('UPDATE despesa SET erro_envio = ? WHERE id = ?', erro, id);
}

async function lerCache<T>(chave: string): Promise<T | null> {
  const linha = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM cache WHERE chave = ?', chave);
  return linha ? (JSON.parse(linha.valor) as T) : null;
}

async function gravarCache(chave: string, valor: unknown): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO cache (chave, valor) VALUES (?, ?)', chave, JSON.stringify(valor));
}

export const cacheVeiculos = {
  ler: () => lerCache<Veiculo[]>('veiculos'),
  gravar: (v: Veiculo[]) => gravarCache('veiculos', v),
};

export const cacheCategorias = {
  ler: () => lerCache<Categoria[]>('categorias'),
  gravar: (c: Categoria[]) => gravarCache('categorias', c),
};

export const cachePerfil = {
  ler: () => lerCache<Perfil>('perfil'),
  gravar: (p: Perfil) => gravarCache('perfil', p),
};

// Endereço da logo da empresa, para mostrar mesmo sem internet (inclusive na tela de login).
export const cacheLogo = {
  ler: () => lerCache<string>('logo'),
  gravar: (url: string | null) => gravarCache('logo', url),
};

// Mostrar a logo bem clarinha no fundo da tela inicial (ligado pelo gestor em Configurações).
export const cacheMarcaDagua = {
  ler: async () => (await lerCache<boolean>('marca-dagua')) ?? false,
  gravar: (ligada: boolean) => gravarCache('marca-dagua', ligada),
};

// Despesas excluídas pelo gestor cujo aviso o motorista já viu.
export const cacheExclusoesVistas = {
  ler: async () => (await lerCache<string[]>('exclusoes-vistas')) ?? [],
  gravar: (ids: string[]) => gravarCache('exclusoes-vistas', ids),
};

// A logo é da empresa, não do motorista: fica para a próxima vez que alguém entrar.
// Despesas que o gestor excluiu: somem do celular (continuam no servidor para consulta do gestor).
export async function apagarDespesas(ids: string[]): Promise<void> {
  for (const id of ids) await db.runAsync('DELETE FROM despesa WHERE id = ?', id);
}

export async function limparTudo(): Promise<void> {
  await db.execAsync("DELETE FROM despesa; DELETE FROM cache WHERE chave <> 'logo';");
}

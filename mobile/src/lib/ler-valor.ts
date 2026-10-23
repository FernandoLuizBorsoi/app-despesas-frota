// Lê o texto da foto do comprovante no próprio celular (sem internet) e tenta achar o valor total.
// O motorista sempre confere: isto só poupa a digitação quando dá certo.
import { extractTextFromImage, isSupported } from 'expo-text-extractor';

// Do mais confiável para o menos. "TOTAL" sozinho vem por último porque também aparece em "SUBTOTAL".
const ROTULOS_TOTAL = [
  /VALOR\s*A\s*PAGAR/,
  /VALOR\s*PAGO/,
  /V(?:A)?L(?:O)?R\.?\s*TOTAL/,
  /TOTAL\s*(?:A\s*PAGAR|GERAL|R\$)/,
  /(?<!SUB)TOTAL/,
];

// Linhas com valores que não são o total da compra.
const IGNORAR =
  /TROCO|DESCONTO|ACRESC|TRIBUT|IMPOST|APROX|LEI\s*12|R\$\s*\/\s*L|P(?:RE)?[CÇ]O|UNIT|QTD|QUANT|LITRO|\bKM\b|CNPJ|CPF/;

// 1.234,56 | 1234,56 | 150.00 (bombas de combustível às vezes usam ponto)
const DINHEIRO = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+)[,.](\d{2})(?![\d.,]*\d)/g;

function valoresDaLinha(linha: string): number[] {
  const valores: number[] = [];
  for (const m of linha.matchAll(DINHEIRO)) {
    const centavos = Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]);
    if (centavos > 0 && centavos < 10_000_000) valores.push(centavos);
  }
  return valores;
}

export function acharTotal(textos: string[]): number | null {
  const linhas = textos
    .flatMap((t) => t.split('\n'))
    .map((l) => l.toUpperCase().trim())
    .filter(Boolean);

  for (const rotulo of ROTULOS_TOTAL) {
    for (const [i, linha] of linhas.entries()) {
      if (!rotulo.test(linha) || IGNORAR.test(linha)) continue;
      // O valor costuma estar na mesma linha; às vezes vem logo abaixo.
      const valor = valoresDaLinha(linha).at(-1) ?? valoresDaLinha(linhas[i + 1] ?? '').at(-1);
      if (valor) return valor;
    }
  }

  // Sem rótulo legível: o total costuma aparecer mais de uma vez (total e forma de pagamento).
  const contagem = new Map<number, number>();
  for (const linha of linhas) {
    if (IGNORAR.test(linha)) continue;
    for (const v of valoresDaLinha(linha)) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  const candidatos = [...contagem.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  return candidatos[0]?.[0] ?? null;
}

// Devolve o valor em centavos, ou null se não conseguiu ler.
export async function lerValorDaFoto(uri: string): Promise<number | null> {
  if (!isSupported) return null;
  try {
    const textos = await extractTextFromImage(uri.replace(/^file:\/\//, ''));
    return acharTotal(textos);
  } catch {
    return null;
  }
}

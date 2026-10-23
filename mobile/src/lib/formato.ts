// Conversões entre o que o motorista digita (padrão brasileiro) e o que é guardado.

export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/[R$\s.]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const centavos = Math.round(Number(limpo) * 100);
  return centavos > 0 ? centavos : null;
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function numeroDeTexto(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  if (limpo === '' || Number.isNaN(Number(limpo))) return null;
  return Number(limpo);
}

// DD/MM/AAAA -> AAAA-MM-DD, ou null se a data não existir.
export function dataIsoDeTexto(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getDate() !== Number(dia) || d.getMonth() !== Number(mes) - 1) return null;
  return `${ano}-${mes}-${dia}`;
}

export function dataTextoDeIso(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function hojeTexto(): string {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
}

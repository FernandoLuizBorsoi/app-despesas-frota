// Motoristas entram com o CPF. Por baixo, o Supabase precisa de um e-mail, então o CPF
// vira um endereço no domínio reservado ".invalid", que nunca recebe mensagens.
export const DOMINIO_CPF = 'cpf.invalid';

export function emailDoLogin(texto: string): string {
  const limpo = texto.trim().toLowerCase();
  const digitos = limpo.replace(/\D/g, '');
  if (!limpo.includes('@') && digitos.length === 11) return `${digitos}@${DOMINIO_CPF}`;
  return limpo;
}

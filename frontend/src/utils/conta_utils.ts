// Minha conta: regras do nome e da exclusão. As mesmas do backend (conta_views.py / ContaNomeSerializer),
// aqui só para avisar a pessoa antes de enviar — quem barra de verdade é o servidor.

import { DEVICE_OFICINA_KEY } from './acesso_equipe_utils';

export const NOME_CONTA_MIN = 2;
export const NOME_CONTA_MAX = 80;

/** A palavra que a pessoa digita para confirmar a exclusão (o servidor confere de novo). */
export const PALAVRA_CONFIRMACAO = 'EXCLUIR';

/** Tira as pontas e junta espaços repetidos ("  Ana   Maria " → "Ana Maria"), como o servidor faz. */
export function normalizarNome(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).join(' ');
}

/** Mensagem do problema com o nome (já normalizado), ou null se estiver bom. */
export function problemaNoNome(nome: string): string | null {
  const n = normalizarNome(nome);
  if (n.length < NOME_CONTA_MIN || !/[\p{L}\p{N}]/u.test(n)) return 'Informe o seu nome (pelo menos 2 letras).';
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(n)) return 'O nome tem caracteres que não podem ser usados.';
  if (n.length > NOME_CONTA_MAX) return `O nome pode ter no máximo ${NOME_CONTA_MAX} caracteres.`;
  return null;
}

export function confirmacaoCorreta(texto: string): boolean {
  return texto.trim().toUpperCase() === PALAVRA_CONFIRMACAO;
}

// Dados deste navegador que só fazem sentido enquanto a oficina existe. Lista explícita (e não "limpar
// tudo") para não apagar preferências que não são da oficina, como o tema claro/escuro.
const CHAVES_DA_OFICINA = ['oficina_config', 'revisacar:atendimento-overlay', DEVICE_OFICINA_KEY];

/** Depois que a oficina é excluída: apaga a cópia local dela. O aparelho esquece qual era a oficina. */
export function limparDadosLocaisDaOficina(): void {
  for (const chave of CHAVES_DA_OFICINA) {
    try { localStorage.removeItem(chave); } catch { /* navegador sem storage: nada a limpar */ }
  }
}

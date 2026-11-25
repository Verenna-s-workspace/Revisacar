import type { Transacao } from './types';

/** Quantas contas o widget do Financeiro mostra antes do "Ver todas". */
export const LIMITE_WIDGET_CONTAS = 6;

/** Data que manda na conta: o vencimento, ou a competência quando não há vencimento. */
export function dataLimiteConta(t: Transacao): string {
  return t.data_vencimento || t.data_competencia;
}

/**
 * Ordena por urgência: o que já venceu vem primeiro (a mais antiga no topo),
 * depois o que vence em breve. Empate de data: maior valor primeiro.
 *
 * Importante: o backend devolve os pendentes pela competência mais recente,
 * então, sem reordenar, as contas vencidas antigas ficavam escondidas do widget.
 */
export function ordenarPorUrgencia(itens: Transacao[]): Transacao[] {
  return [...itens].sort((a, b) => {
    if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
    const porData = dataLimiteConta(a).localeCompare(dataLimiteConta(b));
    if (porData !== 0) return porData;
    return b.valor - a.valor;
  });
}

export function somaValores(itens: Transacao[]): number {
  return itens.reduce((acc, t) => acc + t.valor, 0);
}

/** "2026-11-05" → "05/11/26". */
export function formatDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

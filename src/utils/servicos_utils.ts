// ── Catálogo de Serviços: utilitários ────────────────

import type { ServicoItem } from '../types/servico';

export function formatPreco(preco: number): string {
  return preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Fechamento da OS (etapa 4, opcional): resposta de GET /ordens/<id>/fechamento ──
import type { Orcamento } from './orcamento';

export interface ReservaFechamento {
  itemId: string;
  nome: string;
  reservado: number;
  /** Quantidade física em estoque agora. */
  disponivel: number;
  /** reservado > disponivel: falta peça pra concluir. */
  falta: boolean;
}

export interface BaixaFechamento {
  itemId: string;
  nome: string;
  quantidade: number;
  criadoEm: string;
}

export interface LancamentoFechamento {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  status: 'pendente' | 'pago' | 'cancelado';
  formaPagamento?: string;
  dataPagamento?: string;
}

export interface Fechamento {
  ordemId: string;
  osNum: string;
  osStatus: string;
  concluidaEm?: string;
  concluidaPorNome?: string;
  obsConclusao?: string;
  /** Orçamento APROVADO da OS (preço cobrado; custo só pra quem vê margem). */
  orcamento: Orcamento | null;
  reservas: ReservaFechamento[];
  baixas: BaixaFechamento[];
  /** Só vem pra quem tem financeiro.ver. */
  financeiro?: LancamentoFechamento[];
  /** Só na resposta de POST /concluir. */
  baixasFeitas?: { itemId: string; nome: string; reservado: number; baixado: number; faltou: number }[];
}

/** Corpo do 409 `estoque_insuficiente` ao concluir. */
export interface FaltaAoConcluir {
  itemId: string;
  nome: string;
  necessario: number;
  disponivel: number;
}

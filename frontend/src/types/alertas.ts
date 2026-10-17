// ── Resposta de GET /alertas (dados; o texto e a urgência de cada alerta são da tela) ──

interface IdentificacaoOS {
  ordemId: string;
  osNum: string;
  cliente: string;
  placa: string;
  modelo: string;
}

export interface OrcamentoSemResposta extends IdentificacaoOS {
  orcamentoId: string;
  versao: number;
  total: number;
  enviadoEm?: string | null;
  validadeAte?: string | null;
  vencido: boolean;
  /** Dias desde o envio. */
  dias: number;
}

export interface AprovadaParada extends IdentificacaoOS {
  aprovadoEm?: string | null;
  dias: number;
  total: number | null;
}

export interface ReservaSemEstoque {
  itemId: string;
  nome: string;
  reservado: number;
  emEstoque: number;
  falta: number;
  ordens: { ordemId: string; osNum: string; quantidade: number }[];
}

export interface SemPagamento extends IdentificacaoOS {
  valorPendente: number;
  concluidaEm?: string | null;
  dias: number;
  /** Algum lançamento pendente já passou do vencimento. */
  vencido: boolean;
}

/** Cada bloco só vem pra quem tem a permissão dele (ausente ≠ vazio). */
export interface AlertasBackend {
  hoje: string;
  limites: { orcamentoSemRespostaDias: number; aprovadaParadaDias: number; semPagamentoDias: number };
  orcamentosSemResposta?: OrcamentoSemResposta[];
  aprovadasParadas?: AprovadaParada[];
  reservasSemEstoque?: ReservaSemEstoque[];
  semPagamento?: SemPagamento[];
  /** Origens cujo script SQL ainda não foi rodado: 'orcamentos' | 'estoque_reservas' | 'financeiro'. */
  indisponiveis: string[];
}

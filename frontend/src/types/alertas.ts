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

/** Alerta que ESTE usuário escondeu (por usuário: o que um esconde continua aparecendo pros outros). */
export interface AlertaEscondidoApi {
  /** Id estável do alerta na tela ("<fonte>:<id do objeto>"). */
  alertaId: string;
  /** Adiado até esse momento; null = dispensado (some até a causa se resolver). */
  ate: string | null;
  criadoEm?: string | null;
}

/** Cada bloco só vem pra quem tem a permissão dele (ausente ≠ vazio). */
export interface AlertasBackend {
  hoje: string;
  limites: { orcamentoSemRespostaDias: number; aprovadaParadaDias: number; semPagamentoDias: number };
  orcamentosSemResposta?: OrcamentoSemResposta[];
  aprovadasParadas?: AprovadaParada[];
  reservasSemEstoque?: ReservaSemEstoque[];
  semPagamento?: SemPagamento[];
  /** Adiados (ainda valendo) e dispensados deste usuário; vem pra todo mundo. */
  dispensados?: AlertaEscondidoApi[];
  /** Origens cujo script SQL ainda não foi rodado: 'orcamentos' | 'estoque_reservas' | 'financeiro' | 'alertas_dispensados'. */
  indisponiveis: string[];
}

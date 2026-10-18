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
  /** Há um link ativo mandado pro cliente (Fase 6). */
  linkEnviado?: boolean;
  linkAcessos?: number;
  /** Quando o cliente abriu o link pela primeira vez. */
  linkAbertoEm?: string;
  versao: number;
  total: number;
  enviadoEm?: string | null;
  validadeAte?: string | null;
  vencido: boolean;
  /** Dias desde o envio. */
  dias: number;
}

/** O cliente aprovou ou recusou pelo link nos últimos dias e a OS ainda está nesse estado. */
export interface RespostaDoCliente extends IdentificacaoOS {
  orcamentoId: string;
  versao: number;
  total: number;
  decisao: 'aprovado' | 'recusado';
  decididoEm: string;
  decisaoNome: string;
  motivo: string;
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
  respostasDoCliente?: RespostaDoCliente[];
  /** Adiados (ainda valendo) e dispensados deste usuário; vem pra todo mundo. */
  dispensados?: AlertaEscondidoApi[];
  /** Origens cujo script SQL ainda não foi rodado: 'orcamentos' | 'estoque_reservas' | 'financeiro' | 'orcamento_link' | 'alertas_dispensados'. */
  indisponiveis: string[];
}

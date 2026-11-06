export interface Transacao {
  id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  forma_pagamento: string | null;
  status: 'pendente' | 'pago' | 'cancelado';
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  cliente_nome: string;
  ordem_servico_id: string | null;
  criado_por_nome?: string;
  criado_por_tipo?: string;
  /** Calculado pelo backend na leitura — nunca é gravado como status. */
  vencido: boolean;
}

export interface Categorias {
  entrada: string[];
  saida: string[];
  formas_pagamento: string[];
}

// ── Reserva de caixa ─────────────────────────────────────────────────────────

export interface ReservaConfig {
  ativa: boolean;
  percentual: number;
  escopo: 'servicos' | 'pecas' | 'ambos';
  /** false = a oficina ainda não salvou nada (vale o padrão: desligada). */
  salvo: boolean;
  atualizadoEm: string | null;
}

export interface MovimentoReserva {
  id: string;
  tipo: 'deposito' | 'retirada';
  valor: number;
  descricao: string;
  criadoPorNome: string;
  criadoEm: string;
  // Só depósito: de qual entrada veio e com que regra foi calculado.
  transacaoId?: string;
  categoria?: string | null;
  percentual?: number;
  escopo?: 'servicos' | 'pecas' | 'ambos';
  baseValor?: number;
  ordemServicoId?: string;
}

export interface ReservaResumo {
  ativa: boolean;
  percentual: number;
  escopo: 'servicos' | 'pecas' | 'ambos';
  /** Pode ficar negativo se um pagamento já reservado for estornado depois de a reserva ter sido gasta. */
  saldo: number;
  totalGuardado: number;
  totalRetirado: number;
  movimentos: MovimentoReserva[];
  /** true = há mais movimentos do que os mostrados (os totais continuam somando todos). */
  truncado: boolean;
}

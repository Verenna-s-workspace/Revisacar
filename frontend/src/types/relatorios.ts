// ── Relatórios — Types ──────────────────────────────────────────────────────

export type PeriodoPreset =
  | 'hoje'
  | 'ultimos_7_dias'
  | 'ultimos_30_dias'
  | 'este_mes'
  | 'mes_passado'
  | 'personalizado';

export interface IntervaloDatas {
  inicio: Date;
  fim: Date;
}

export interface FiltroPeriodo {
  preset: PeriodoPreset;
  /** Só é lido quando preset === 'personalizado'. */
  personalizado?: IntervaloDatas;
}

export type Granularidade = 'dia' | 'semana' | 'mes';

/** Um ponto da série temporal, já alinhado por posição entre período atual e anterior. */
export interface PontoSerieTemporal {
  rotulo: string;
  atual: number | null;
  anterior: number | null;
}

export interface ServicoRealizado {
  nome: string;
  quantidade: number;
  percentual: number;
}

export interface ComparacaoValor {
  atual: number;
  /** null quando não há período anterior com dados para comparar. */
  anterior: number | null;
  /** null quando `anterior` é null ou zero — nesse caso a UI deve ocultar a comparação. */
  variacaoPercentual: number | null;
}

export interface KpisRelatorio {
  faturamento: ComparacaoValor;
  ordensServico: ComparacaoValor;
  ticketMedio: ComparacaoValor;
}

export interface MediaDiariaPeriodo {
  total: number;
  dias: number;
  media: number;
  rotulo: string;
}

/** Bloco de "média diária" — só faz sentido para comparações mensais (este mês / mês passado). */
export interface MediaDiaria {
  atual: MediaDiariaPeriodo;
  anterior: MediaDiariaPeriodo | null;
}

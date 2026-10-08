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


// ── Resposta de GET /relatorios (agregada no servidor) ──────────────────────

/** De onde veio o faturamento: entradas lançadas no Financeiro, ou estimativa por OS finalizada. */
export type FaturamentoOrigem = 'financeiro' | 'estimado';

/** Um dia com algum dado. `dia` é YYYY-MM-DD no fuso enviado ao servidor. A série é esparsa (dias sem dado não vêm). */
export interface DiaRelatorio {
  dia: string;
  ordens: number;
  finalizadas: number;
  faturamento: number;
}

export interface TotaisPeriodo {
  faturamento: number;
  ordens: number;
  finalizadas: number;
}

export interface ServicoContado {
  nome: string;
  quantidade: number;
}

export interface RelatorioResposta {
  faturamentoOrigem: FaturamentoOrigem;
  totais: {
    atual: TotaisPeriodo;
    /** null = nenhuma OS no período anterior (nada a comparar). */
    anterior: TotaisPeriodo | null;
  };
  /** Cobre período atual e anterior. */
  dias: DiaRelatorio[];
  /** OS finalizadas do período atual, da mais para a menos frequente. */
  servicos: ServicoContado[];
}

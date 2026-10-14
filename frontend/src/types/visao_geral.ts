// ── Visão Geral — resposta de GET /visao-geral ──────────────────────────────
//
// Os blocos de DINHEIRO (faturamento, meta, financeiro, serie[].faturamento,
// servicos[].valorEstimado) só vêm para quem tem permissão: a UI decide o que
// desenhar pela presença do bloco, não pelo cargo.

import type { FaturamentoOrigem } from './relatorios';

export interface VisaoGeralSerieDia {
  /** YYYY-MM-DD no fuso enviado ao servidor. */
  dia: string;
  ordens: number;
  faturamento?: number;
}

export interface VisaoGeralServico {
  nome: string;
  quantidade: number;
  /** Quantidade por dia da semana, índice 0 = segunda … 6 = domingo. */
  semana: number[];
  valorEstimado?: number;
}

export interface VisaoGeralFinanceiro {
  receitas: number;
  despesas: number;
  /** false = nenhum lançamento nos dois meses → a tela pede para lançar, em vez de mostrar zeros. */
  temLancamentos: boolean;
  /** Só dono (financeiro.ver_margem). */
  lucro?: number;
  lucroAnterior?: number;
  lucroVariacaoPercentual?: number;
}

export interface VisaoGeral {
  hoje: string;
  periodo: { de: string; ate: string; deAnterior: string; ateAnterior: string; tz: string };
  ordens: { atual: number; anterior: number | null };
  /** 31 dias terminando hoje, um item por dia. */
  serie: VisaoGeralSerieDia[];
  /** OS finalizadas dos últimos 30 dias, já ordenadas pelo servidor. */
  servicos: VisaoGeralServico[];
  faturamento?: { atual: number; anterior: number | null; origem: FaturamentoOrigem };
  meta?: { valor: number | null; editavel: boolean };
  financeiro?: VisaoGeralFinanceiro;
}

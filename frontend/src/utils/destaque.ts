import type { NavPage } from '../types/dashboard';

// ── Destaque ao chegar ───────────────────────────────────────────────────────
// Clicar num card da Visão Geral leva à tela de destino e faz o(s) elemento(s)
// correspondente(s) pulsarem por alguns segundos. Cada elemento de destino
// carrega `data-destaque-id="<id abaixo>"`; o hook useDestaqueAoChegar acha
// pelo id. Pra mudar o que cada card destaca, mexa só em DESTINOS_VISAO_GERAL.

export interface Destaque {
  alvos: string[];
  /** Muda a cada clique: clicar duas vezes no mesmo card refaz a animação. */
  nonce: number;
}

export interface DestinoCard {
  page: NavPage;
  alvos: string[];
}

/** Quanto tempo (ms) o elemento fica com a aura. Mantenha em sincronia com
 *  `.destaque-aura` em dashboard.css (atraso 0,3s + 2 pulsos de 2s = 4,3s). */
export const DURACAO_DESTAQUE_MS = 4400;

export const ALVO = {
  finKpiFaturamento: 'fin-kpi-faturamento',
  finKpiDespesas: 'fin-kpi-despesas',
  finKpiLucro: 'fin-kpi-lucro',
  relKpiFaturamento: 'rel-kpi-faturamento',
  relKpiOs: 'rel-kpi-os',
  relGraficoFaturamento: 'rel-grafico-faturamento',
  relGraficoOs: 'rel-grafico-os',
  relServicosMaisRealizados: 'rel-servicos-mais-realizados',
} as const;

export const DESTINOS_VISAO_GERAL = {
  /** Faturamento do mês → Financeiro, no KPI de Faturamento. */
  faturamentoMes: { page: 'financeiro', alvos: [ALVO.finKpiFaturamento] },
  /** Ordens de serviço → Relatórios: KPI de OS + gráfico de OS (os dois). */
  ordensServico: { page: 'relatorios', alvos: [ALVO.relKpiOs, ALVO.relGraficoOs] },
  /** Análise de faturamento → Relatórios: KPI + gráfico de faturamento (os dois). */
  analiseFaturamento: { page: 'relatorios', alvos: [ALVO.relKpiFaturamento, ALVO.relGraficoFaturamento] },
  /** Quem não vê dinheiro enxerga "Ordens por dia" nesse card: leva às OS. */
  analiseOrdens: { page: 'relatorios', alvos: [ALVO.relKpiOs, ALVO.relGraficoOs] },
  /** Top serviços → Relatórios, em "Serviços mais realizados". */
  topServicos: { page: 'relatorios', alvos: [ALVO.relServicosMaisRealizados] },
  /** Resumo financeiro (receitas / custos / lucro) → Financeiro: os 3 KPIs equivalentes. */
  resumoFinanceiro: { page: 'financeiro', alvos: [ALVO.finKpiFaturamento, ALVO.finKpiDespesas, ALVO.finKpiLucro] },
} as const satisfies Record<string, DestinoCard>;

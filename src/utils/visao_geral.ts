import type { FaturamentoDia } from '../types/dashboard';
import type { VisaoGeralSerieDia, VisaoGeralServico } from '../types/visao_geral';

export const PERIODOS_GRAFICO = ['Últimos 7 dias', 'Últimos 30 dias', 'Este mês'] as const;
export type PeriodoGrafico = (typeof PERIODOS_GRAFICO)[number];

export const ORDEM_TOP_SERVICOS = ['Por faturamento', 'Por quantidade'] as const;
export type OrdemTopServicos = (typeof ORDEM_TOP_SERVICOS)[number];

/** 'YYYY-MM-DD' → Date local (new Date('YYYY-MM-DD') seria UTC e podia cair no dia anterior). */
export function dataLocal(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** "09 Out" (antes saía "09 De Out": a regra de maiúscula pegava o "de"). */
function rotuloDia(dia: string): string {
  const d = dataLocal(dia);
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${String(d.getDate()).padStart(2, '0')} ${mes.charAt(0).toUpperCase()}${mes.slice(1)}`;
}

/**
 * Recorta a série de 31 dias do servidor para o período escolhido no card.
 * `valor` é o faturamento quando o usuário pode ver dinheiro; senão, a
 * quantidade de ordens (o gráfico muda o formato junto).
 */
export function serieDoPeriodo(
  serie: VisaoGeralSerieDia[],
  hoje: string,
  periodo: PeriodoGrafico,
  comDinheiro: boolean
): FaturamentoDia[] {
  let recorte: VisaoGeralSerieDia[];
  if (periodo === 'Últimos 7 dias') recorte = serie.slice(-7);
  else if (periodo === 'Últimos 30 dias') recorte = serie.slice(-30);
  else {
    const inicioMes = `${hoje.slice(0, 7)}-01`;
    recorte = serie.filter((d) => d.dia >= inicioMes && d.dia <= hoje);
  }
  return recorte.map((d) => ({
    dia: rotuloDia(d.dia),
    valor: comDinheiro ? d.faturamento ?? 0 : d.ordens,
    ordens: d.ordens,
  }));
}

/** Ordena o Top Serviços pelo critério escolhido e fica com os 5 primeiros. */
export function topServicos(
  servicos: VisaoGeralServico[],
  ordem: OrdemTopServicos,
  comDinheiro: boolean
): VisaoGeralServico[] {
  const porValor = comDinheiro && ordem === 'Por faturamento';
  return [...servicos]
    .sort((a, b) =>
      porValor
        ? (b.valorEstimado ?? 0) - (a.valorEstimado ?? 0) || b.quantidade - a.quantidade || a.nome.localeCompare(b.nome)
        : b.quantidade - a.quantidade || (b.valorEstimado ?? 0) - (a.valorEstimado ?? 0) || a.nome.localeCompare(b.nome)
    )
    .slice(0, 5);
}

/** Percentual do lucro/receita para a barra: 0–100 (o texto ao lado mostra o valor real). */
export function limitarPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

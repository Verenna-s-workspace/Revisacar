import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import type { Alerta, DashData, FaturamentoDia, OrdemRow } from '../types/dashboard';
// TICKET e SVC_PRECO agora moram em utils/relatorios.ts (usado também pela
// tela de Relatórios) — reexportado aqui para quem já importava daqui.
import { SVC_PRECO, TICKET } from '../utils/relatorios';

export { TICKET };

const MONTH_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Resumo financeiro real vindo de GET /financeiro/resumo. `lucro`/`margem` só
 * chegam para quem tem a permissão `financeiro.ver_margem`.
 */
export interface ResumoFinanceiro {
  faturamento: number;
  despesas: number;
  recebido: number;
  saldo: number;
  lucro?: number;
  margem_percentual?: number;
}

/** Transação enxuta usada só para montar o gráfico diário de faturamento. */
export interface TransacaoLite {
  tipo: 'entrada' | 'saida';
  valor: number;
  status: 'pendente' | 'pago';
  data_competencia: string;
}

export function safePct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Primeiro e último dia (ISO yyyy-mm-dd) do mês da data informada. */
export function intervaloDoMes(base: Date): { de: string; ate: string } {
  const de = new Date(base.getFullYear(), base.getMonth(), 1);
  const ate = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { de: isoDay(de), ate: isoDay(ate) };
}

function rotuloDia(d: Date): string {
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', ' ')
    .replace(/\b(\w)/g, (c) => c.toUpperCase());
}

/**
 * Faturamento diário (últimos 7 dias) a partir das ENTRADAS reais do
 * financeiro. O número de ordens por dia continua vindo das OS.
 */
export function buildDailyFromTransacoes(
  transacoes: TransacaoLite[],
  ordens: OrdemRow[],
  hoje: Date = new Date(),
): FaturamentoDia[] {
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(hoje);
    d.setHours(0, 0, 0, 0);
    d.setDate(hoje.getDate() - (6 - index));
    const dayIso = isoDay(d);

    const valor = transacoes
      .filter((t) => t.tipo === 'entrada' && t.data_competencia === dayIso)
      .reduce((soma, t) => soma + (t.valor ?? 0), 0);

    const ordensDoDia = ordens.filter((o) => {
      const od = new Date(o.created_at);
      return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    }).length;

    return { dia: rotuloDia(d), valor, ordens: ordensDoDia };
  });
}

/** Faturamento diário ESTIMADO (fallback quando não há dados financeiros). */
function buildDailyEstimado(ordens: OrdemRow[], hoje: Date = new Date()): FaturamentoDia[] {
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(hoje);
    d.setHours(0, 0, 0, 0);
    d.setDate(hoje.getDate() - (6 - index));

    const dayOrdens = ordens.filter((o) => {
      const od = new Date(o.created_at);
      return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });

    const finished = dayOrdens.filter((o) => o.status === 'finalizada').length;
    return { dia: rotuloDia(d), valor: finished * TICKET, ordens: dayOrdens.length };
  });
}

function extractTopServicos(ordens: OrdemRow[]) {
  const svcDay: Record<string, number[]> = {};
  ordens.forEach((o) => {
    const dow = new Date(o.created_at).getDay();
    const services: string[] = o.payload?.servicos_selecionados ?? [];
    services.forEach((name) => {
      if (!svcDay[name]) svcDay[name] = [0, 0, 0, 0, 0, 0, 0];
      svcDay[name][dow] += 1;
    });
  });

  return Object.entries(svcDay)
    .map(([nome, days]) => ({
      nome,
      valor: days.reduce((sum, value) => sum + value, 0) * (SVC_PRECO[nome] ?? 200),
      heatmap: MONTH_ORDER.map((dayOfWeek) => days[dayOfWeek] ?? 0),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
}

/**
 * Base do dashboard a partir só das OS. O dinheiro aqui é ESTIMADO
 * (nº de OS finalizadas × ticket) e serve apenas de fallback quando o módulo
 * financeiro não está disponível — `mergeFinanceiro` sobrescreve com o real.
 */
function buildFromOrdens(ordens: OrdemRow[]): DashData {
  const today = new Date();
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const currentMonth = ordens.filter((o) => formatMonthKey(new Date(o.created_at)) === formatMonthKey(today));
  const previousMonth = ordens.filter((o) => formatMonthKey(new Date(o.created_at)) === formatMonthKey(prevMonth));

  const fatAtual = currentMonth.filter((o) => o.status === 'finalizada').length * TICKET;
  const fatAnterior = previousMonth.filter((o) => o.status === 'finalizada').length * TICKET;
  const ordAtual = currentMonth.length;
  const ordAnterior = previousMonth.length;

  const metaMensal = 20000;
  const metaAlc = Math.min(fatAtual, metaMensal);
  const metaPct = Math.round(metaMensal > 0 ? (metaAlc / metaMensal) * 100 : 0);
  const emAnd = ordens.filter((o) => o.status === 'rascunho').length;

  const alertas: Alerta[] = [
    ...(emAnd > 0 ? [{ tipo: 'warn' as const, msg: `${emAnd} ordem${emAnd > 1 ? 's' : ''} aguardando aprovação`, detalhe: '' }] : []),
    { tipo: 'info', msg: `${ordAtual} ordens neste mês`, detalhe: '' },
    { tipo: 'info', msg: `${fatAtual === 0 ? 'Sem faturamento ainda' : 'Faturamento atualizado'}`, detalhe: '' },
  ];

  return {
    ordens,
    fatAtual,
    fatAnterior,
    fatPct: safePct(fatAtual, fatAnterior),
    ordAtual,
    ordAnterior,
    ordPct: safePct(ordAtual, ordAnterior),
    metaMensal,
    metaAlc,
    metaPct,
    fatDiario: buildDailyEstimado(ordens),
    topServicos: extractTopServicos(ordens),
    receitas: fatAtual,
    // custos/lucro não são calculáveis a partir das OS — vêm da tela Financeiro
    custos: 0,
    lucro: 0,
    alertas,
    isDemo: false,
  };
}

/**
 * Sobrescreve os KPIs de dinheiro da base (estimados) pelos valores REAIS do
 * módulo financeiro. Contagens de OS, metas e serviços continuam vindo das OS.
 * Função pura para ser testável sem rede.
 */
export function mergeFinanceiro(
  base: DashData,
  atual: ResumoFinanceiro,
  anterior: ResumoFinanceiro,
  fatDiario: FaturamentoDia[],
): DashData {
  const fatAtual = atual.faturamento;
  const fatAnterior = anterior.faturamento;
  const metaAlc = Math.min(fatAtual, base.metaMensal);
  const metaPct = Math.round(base.metaMensal > 0 ? (metaAlc / base.metaMensal) * 100 : 0);

  const alertas: Alerta[] = base.alertas.map((a) =>
    a.msg.includes('faturamento') || a.msg.includes('Faturamento')
      ? { ...a, msg: fatAtual === 0 ? 'Sem faturamento no mês' : 'Faturamento (dados reais)' }
      : a,
  );

  return {
    ...base,
    fatAtual,
    fatAnterior,
    fatPct: safePct(fatAtual, fatAnterior),
    metaAlc,
    metaPct,
    fatDiario,
    receitas: fatAtual,
    custos: atual.despesas,
    lucro: atual.lucro ?? 0,
    alertas,
  };
}

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashData>(buildFromOrdens([]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ordens: OrdemRow[] = await api.listarOrdens();
      const base = buildFromOrdens(ordens);

      // Tenta enriquecer com dados financeiros REAIS. Se o módulo estiver vazio,
      // o usuário não tiver permissão (financeiro.ver) ou a rede falhar, mantém
      // a estimativa da base sem quebrar a tela.
      try {
        const hoje = new Date();
        const mesAtual = intervaloDoMes(hoje);
        const mesAnterior = intervaloDoMes(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(hoje.getDate() - 6);

        const [resumoAtual, resumoAnterior, transacoes] = await Promise.all([
          api.resumoFinanceiro(mesAtual) as Promise<ResumoFinanceiro>,
          api.resumoFinanceiro(mesAnterior) as Promise<ResumoFinanceiro>,
          api.listarTransacoes({ de: isoDay(seteDiasAtras), ate: isoDay(hoje), tipo: 'entrada' }) as Promise<TransacaoLite[]>,
        ]);

        const fatDiario = buildDailyFromTransacoes(transacoes ?? [], ordens, hoje);
        setData(mergeFinanceiro(base, resumoAtual, resumoAnterior, fatDiario));
      } catch {
        setData(base);
      }
    } catch {
      setData(buildFromOrdens([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { loading, data, reload: load };
}

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import type { Alerta, DashData, FaturamentoDia, OrdemRow } from '../types/dashboard';
// TICKET e SVC_PRECO agora moram em utils/relatorios.ts (usado também pela
// tela de Relatórios) — reexportado aqui para quem já importava daqui.
import { SVC_PRECO, TICKET } from '../utils/relatorios';

export { TICKET };

const MONTH_ORDER = [1, 2, 3, 4, 5, 6, 0];

function safePct(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function buildDailyFaturamento(ordens: OrdemRow[]): FaturamentoDia[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(today.getDate() - (6 - index));

    const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      .replace('.', ' ').replace(/\b(\w)/g, c => c.toUpperCase());

    const dayOrdens = ordens.filter(o => {
      const od = new Date(o.created_at);
      return od.getDate() === d.getDate() && od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
    });

    const finished = dayOrdens.filter(o => o.status === 'finalizada').length;
    return { dia, valor: finished * TICKET, ordens: dayOrdens.length };
  });
}

function extractTopServicos(ordens: OrdemRow[]) {
  const svcDay: Record<string, number[]> = {};
  ordens.forEach(o => {
    const dow = new Date(o.created_at).getDay();
    const services: string[] = o.payload?.servicos_selecionados ?? [];
    services.forEach(name => {
      if (!svcDay[name]) svcDay[name] = [0, 0, 0, 0, 0, 0, 0];
      svcDay[name][dow] += 1;
    });
  });

  return Object.entries(svcDay)
    .map(([nome, days]) => ({
      nome,
      valor: days.reduce((sum, value) => sum + value, 0) * (SVC_PRECO[nome] ?? 200),
      heatmap: MONTH_ORDER.map(dayOfWeek => days[dayOfWeek] ?? 0),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
}

function buildFromOrdens(ordens: OrdemRow[]): DashData {
  const today = new Date();
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const currentMonth = ordens.filter(o => formatMonthKey(new Date(o.created_at)) === formatMonthKey(today));
  const previousMonth = ordens.filter(o => formatMonthKey(new Date(o.created_at)) === formatMonthKey(prevMonth));

  const fatAtual = currentMonth.filter(o => o.status === 'finalizada').length * TICKET;
  const fatAnterior = previousMonth.filter(o => o.status === 'finalizada').length * TICKET;
  const ordAtual = currentMonth.length;
  const ordAnterior = previousMonth.length;

  const fatPct = safePct(fatAtual, fatAnterior);
  const ordPct = safePct(ordAtual, ordAnterior);

  const fatDiario = buildDailyFaturamento(ordens);
  const topServicos = extractTopServicos(ordens);
  const metaMensal = 20000;
  const metaAlc = Math.min(fatAtual, metaMensal);
  const metaPct = Math.round(metaMensal > 0 ? (metaAlc / metaMensal) * 100 : 0);
  const emAnd = ordens.filter(o => o.status === 'rascunho').length;

  const alertas: Alerta[] = [
    { tipo: 'crit', msg: 'Verifique o estoque e evite atrasos nos serviços.', detalhe: '' },
    ...(emAnd > 0 ? [{ tipo: 'warn' as const, msg: `${emAnd} ordem${emAnd > 1 ? 's' : ''} aguardando aprovação`, detalhe: '' }] : []),
    { tipo: 'info', msg: `${ordAtual} ordens neste mês`, detalhe: '' },
    { tipo: 'info', msg: `${fatAtual === 0 ? 'Sem faturamento ainda' : 'Faturamento atualizado'}`, detalhe: '' },
  ];

  return {
    ordens,
    fatAtual,
    fatAnterior,
    fatPct,
    ordAtual,
    ordAnterior,
    ordPct,
    metaMensal,
    metaAlc,
    metaPct,
    fatDiario,
    topServicos,
    receitas: fatAtual,
    custos: Math.round(fatAtual * 0.59),
    lucro: Math.round(fatAtual * 0.41),
    alertas,
    isDemo: false,
  };
}

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashData>(buildFromOrdens([]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ordens: OrdemRow[] = await api.listarOrdens();
      setData(buildFromOrdens(ordens));
    } catch {
      setData(buildFromOrdens([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { loading, data, reload: load };
}

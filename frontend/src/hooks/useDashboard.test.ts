import { describe, it, expect } from 'vitest';
import {
  safePct,
  intervaloDoMes,
  buildDailyFromTransacoes,
  mergeFinanceiro,
  type ResumoFinanceiro,
  type TransacaoLite,
} from './useDashboard';
import type { DashData, OrdemRow } from '../types/dashboard';

describe('safePct', () => {
  it('calcula variação percentual', () => {
    expect(safePct(150, 100)).toBe(50);
    expect(safePct(80, 100)).toBe(-20);
  });
  it('trata base zero sem dividir por zero', () => {
    expect(safePct(0, 0)).toBe(0);
    expect(safePct(10, 0)).toBe(100);
  });
});

describe('intervaloDoMes', () => {
  it('retorna primeiro e último dia do mês', () => {
    expect(intervaloDoMes(new Date(2026, 1, 15))).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(intervaloDoMes(new Date(2026, 0, 10))).toEqual({ de: '2026-01-01', ate: '2026-01-31' });
  });
});

describe('buildDailyFromTransacoes', () => {
  const hoje = new Date(2026, 7, 24); // 24/ago/2026

  it('soma apenas ENTRADAS do dia correspondente', () => {
    const transacoes: TransacaoLite[] = [
      { tipo: 'entrada', valor: 300, status: 'pago', data_competencia: '2026-08-24' },
      { tipo: 'entrada', valor: 200, status: 'pago', data_competencia: '2026-08-24' },
      { tipo: 'saida', valor: 999, status: 'pago', data_competencia: '2026-08-24' }, // ignorada
      { tipo: 'entrada', valor: 100, status: 'pago', data_competencia: '2026-08-20' },
    ];
    const serie = buildDailyFromTransacoes(transacoes, [], hoje);
    expect(serie).toHaveLength(7);
    const ultimo = serie[serie.length - 1]; // hoje
    expect(ultimo.valor).toBe(500); // 300 + 200, saída não conta
  });

  it('conta ordens do dia a partir das OS', () => {
    const ordens: OrdemRow[] = [
      { id: '1', os_num: '1', cliente: 'A', placa: 'ABC1D23', modelo: 'Gol', status: 'finalizada', created_at: '2026-08-24T09:00:00', updated_at: '' },
    ];
    const serie = buildDailyFromTransacoes([], ordens, hoje);
    expect(serie[serie.length - 1].ordens).toBe(1);
    expect(serie[serie.length - 1].valor).toBe(0); // sem transações -> 0 real
  });
});

describe('mergeFinanceiro', () => {
  const base: DashData = {
    ordens: [],
    fatAtual: 4800, fatAnterior: 2400, fatPct: 100,
    ordAtual: 10, ordAnterior: 8, ordPct: 25,
    metaMensal: 20000, metaAlc: 4800, metaPct: 24,
    fatDiario: [], topServicos: [],
    receitas: 4800, custos: 0, lucro: 0,
    alertas: [{ tipo: 'info', msg: 'Faturamento atualizado', detalhe: '' }],
    isDemo: false,
  };

  it('substitui KPIs de dinheiro pelos valores reais do financeiro', () => {
    const atual: ResumoFinanceiro = { faturamento: 12000, despesas: 5000, recebido: 11000, saldo: 6000, lucro: 7000 };
    const anterior: ResumoFinanceiro = { faturamento: 8000, despesas: 3000, recebido: 8000, saldo: 5000 };
    const merged = mergeFinanceiro(base, atual, anterior, []);

    expect(merged.fatAtual).toBe(12000);
    expect(merged.fatAnterior).toBe(8000);
    expect(merged.receitas).toBe(12000);
    expect(merged.custos).toBe(5000);
    expect(merged.lucro).toBe(7000);
    expect(merged.fatPct).toBe(50); // (12000-8000)/8000
    expect(merged.metaPct).toBe(60); // 12000/20000
    // contagens de OS preservadas
    expect(merged.ordAtual).toBe(10);
  });

  it('lucro vira 0 quando o usuário não tem permissão de ver margem', () => {
    const atual: ResumoFinanceiro = { faturamento: 1000, despesas: 400, recebido: 900, saldo: 500 };
    const merged = mergeFinanceiro(base, atual, atual, []);
    expect(merged.lucro).toBe(0);
  });
});

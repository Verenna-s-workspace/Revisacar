import { describe, it, expect } from 'vitest';
import {
  valorOS,
  apenasFinalizadas,
  calcularVariacao,
  calcularServicosMaisRealizados,
  formatarPercentual,
  TICKET,
  SVC_PRECO,
} from './relatorios';
import type { OrdemRow } from '../types/dashboard';

function ordem(partial: Partial<OrdemRow>): OrdemRow {
  return {
    id: 'x',
    os_num: '1',
    cliente: 'Fulano',
    placa: 'ABC1D23',
    modelo: 'Gol',
    status: 'finalizada',
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    ...partial,
  };
}

describe('valorOS', () => {
  it('usa valor_total real quando o backend expõe', () => {
    expect(valorOS(ordem({ valor_total: 1234 }))).toBe(1234);
  });

  it('soma o preço dos serviços reconhecidos quando não há valor_total', () => {
    const o = ordem({ payload: { servicos_selecionados: ['Troca de Óleo', 'Freios'] } });
    expect(valorOS(o)).toBe(SVC_PRECO['Troca de Óleo'] + SVC_PRECO['Freios']);
  });

  it('cai no ticket padrão quando não há serviço reconhecido', () => {
    expect(valorOS(ordem({ payload: { servicos_selecionados: [] } }))).toBe(TICKET);
    expect(valorOS(ordem({ payload: { servicos_selecionados: ['Serviço Inexistente'] } }))).toBe(TICKET);
  });
});

describe('apenasFinalizadas', () => {
  it('filtra somente OS finalizadas', () => {
    const ordens = [
      ordem({ id: 'a', status: 'finalizada' }),
      ordem({ id: 'b', status: 'rascunho' }),
      ordem({ id: 'c', status: 'finalizada' }),
    ];
    expect(apenasFinalizadas(ordens).map((o) => o.id)).toEqual(['a', 'c']);
  });
});

describe('calcularVariacao', () => {
  it('retorna variação percentual quando há base', () => {
    expect(calcularVariacao(150, 100)).toBe(50);
    expect(calcularVariacao(50, 100)).toBe(-50);
  });

  it('retorna null quando a base é 0 ou nula (evita divisão por zero)', () => {
    expect(calcularVariacao(100, 0)).toBeNull();
    expect(calcularVariacao(100, null)).toBeNull();
  });
});

describe('calcularServicosMaisRealizados', () => {
  it('conta serviços e ordena por quantidade (composto com apenasFinalizadas)', () => {
    const ordens = [
      ordem({ status: 'finalizada', payload: { servicos_selecionados: ['Freios', 'Freios'] } }),
      ordem({ status: 'finalizada', payload: { servicos_selecionados: ['Freios'] } }),
      ordem({ status: 'finalizada', payload: { servicos_selecionados: ['Motor'] } }),
      ordem({ status: 'rascunho', payload: { servicos_selecionados: ['Motor', 'Motor', 'Motor'] } }),
    ];
    // Uso real: o filtro de finalizadas é responsabilidade do chamador.
    const resultado = calcularServicosMaisRealizados(apenasFinalizadas(ordens));
    expect(resultado[0].nome).toBe('Freios');
    expect(resultado[0].quantidade).toBe(3);
    const motor = resultado.find((s) => s.nome === 'Motor');
    expect(motor?.quantidade).toBe(1); // as 3 de rascunho foram filtradas antes
  });
});

describe('formatarPercentual', () => {
  it('prefixa + em valores positivos', () => {
    expect(formatarPercentual(12.3)).toBe('+12,3%');
  });
  it('mantém sinal negativo sem prefixo extra', () => {
    expect(formatarPercentual(-5)).toBe('-5%');
  });
});

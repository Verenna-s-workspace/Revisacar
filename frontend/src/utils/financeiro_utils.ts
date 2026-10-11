import type { Transacao, Categorias } from '../features/Dashboard/Financeiro/types';
import type { ResumoFinanceiro } from '../features/Dashboard/Financeiro/KpiCards';

// ── Dados de demonstração ───────────────────────────────────────────────────
//
// Só usados em desenvolvimento, quando a API real falha (ver FinanceiroPage.tsx
// — fallback restrito a import.meta.env.DEV, mesmo critério de
// hooks/useEstoque.ts e hooks/useRelatorios.ts). Faturamento e margem fictícios
// têm o mesmo risco que estoque fictício descrito lá: alguém pode tomar uma
// decisão real em cima de um número inventado — por isso isso nunca aparece em
// produção, e uma resposta bem sucedida (mesmo vazia) nunca é substituída por
// isto, em nenhum ambiente.

/** "YYYY-MM-DD" no calendário LOCAL. `toISOString()` converte para UTC e, à
 *  noite no Brasil (depois das 21h), devolve o dia seguinte. */
export function isoLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function hojeLocal(): string {
  return isoLocal(new Date());
}

function diaDoMes(dia: number, offsetMeses = 0): string {
  const hoje = new Date();
  return isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + offsetMeses, Math.min(dia, 28)));
}

function dataAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoLocal(d);
}

function calcVencido(status: Transacao['status'], dataVencimento: string | null): boolean {
  if (status !== 'pendente' || !dataVencimento) return false;
  return dataVencimento < hojeLocal();
}

let seq = 0;
function proximoId(): string {
  seq += 1;
  return `demo-fin-${seq}`;
}

type SeedInput = Omit<Transacao, 'id' | 'vencido' | 'criado_por_nome' | 'criado_por_tipo' | 'ordem_servico_id'>;

function novaTransacao(base: SeedInput): Transacao {
  return {
    ...base,
    id: proximoId(),
    ordem_servico_id: null,
    criado_por_nome: 'Dono',
    criado_por_tipo: 'dono',
    vencido: calcVencido(base.status, base.data_vencimento),
  };
}

export function buildSeedTransacoes(): Transacao[] {
  seq = 0;
  return [
    // Entradas pagas — este mês
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Revisão completa — Gol 1.6', valor: 480, forma_pagamento: 'pix', status: 'pago', data_competencia: diaDoMes(3), data_vencimento: null, data_pagamento: diaDoMes(3), cliente_nome: 'Marcos Aurélio' }),
    novaTransacao({ tipo: 'entrada', categoria: 'pecas', descricao: 'Troca de pastilhas e discos', valor: 620, forma_pagamento: 'credito', status: 'pago', data_competencia: diaDoMes(6), data_vencimento: null, data_pagamento: diaDoMes(6), cliente_nome: 'Fernanda Lima' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Troca de óleo e filtros', valor: 210, forma_pagamento: 'dinheiro', status: 'pago', data_competencia: diaDoMes(9), data_vencimento: null, data_pagamento: diaDoMes(9), cliente_nome: 'Ricardo Nunes' }),
    novaTransacao({ tipo: 'entrada', categoria: 'acessorios', descricao: 'Instalação de som e alarme', valor: 350, forma_pagamento: 'debito', status: 'pago', data_competencia: diaDoMes(13), data_vencimento: null, data_pagamento: diaDoMes(13), cliente_nome: 'Juliana Prado' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Alinhamento e balanceamento', valor: 180, forma_pagamento: 'pix', status: 'pago', data_competencia: diaDoMes(17), data_vencimento: null, data_pagamento: diaDoMes(17), cliente_nome: 'Carlos Eduardo' }),
    novaTransacao({ tipo: 'entrada', categoria: 'pecas', descricao: 'Bateria 60Ah', valor: 480, forma_pagamento: 'credito', status: 'pago', data_competencia: diaDoMes(21), data_vencimento: null, data_pagamento: diaDoMes(21), cliente_nome: 'Patrícia Gomes' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Troca de embreagem — Corolla', valor: 1450, forma_pagamento: 'credito', status: 'pago', data_competencia: diaDoMes(10), data_vencimento: null, data_pagamento: diaDoMes(10), cliente_nome: 'Eduardo Ramos' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Revisão completa — Civic', valor: 890, forma_pagamento: 'pix', status: 'pago', data_competencia: diaDoMes(16), data_vencimento: null, data_pagamento: diaDoMes(16), cliente_nome: 'Camila Duarte' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Funilaria e pintura — para-choque', valor: 1200, forma_pagamento: 'boleto', status: 'pago', data_competencia: diaDoMes(19), data_vencimento: null, data_pagamento: diaDoMes(19), cliente_nome: 'Rogério Xavier' }),
    novaTransacao({ tipo: 'entrada', categoria: 'pecas', descricao: 'Troca de amortecedores (par)', valor: 680, forma_pagamento: 'debito', status: 'pago', data_competencia: diaDoMes(23), data_vencimento: null, data_pagamento: diaDoMes(23), cliente_nome: 'Beatriz Nogueira' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Retífica de motor — parcial', valor: 2200, forma_pagamento: 'boleto', status: 'pago', data_competencia: diaDoMes(25), data_vencimento: null, data_pagamento: diaDoMes(25), cliente_nome: 'Thiago Barbosa' }),
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Diagnóstico e reparo elétrico', valor: 320, forma_pagamento: 'pix', status: 'pago', data_competencia: diaDoMes(26), data_vencimento: null, data_pagamento: diaDoMes(26), cliente_nome: 'Helena Farias' }),

    // A receber — dentro do prazo
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Revisão de suspensão — parcelado', valor: 540, forma_pagamento: 'boleto', status: 'pendente', data_competencia: diaDoMes(11), data_vencimento: dataAtras(-7), data_pagamento: null, cliente_nome: 'Anderson Melo' }),

    // A receber — vencida, competência do mês passado. Some da lista ao
    // filtrar "este mês", mas continua contando em a_receber/vencido_receber
    // (dívida em aberto agora, não um corte de período — mesma regra do backend).
    novaTransacao({ tipo: 'entrada', categoria: 'pecas', descricao: 'Kit de embreagem', valor: 890, forma_pagamento: 'boleto', status: 'pendente', data_competencia: diaDoMes(20, -1), data_vencimento: dataAtras(10), data_pagamento: null, cliente_nome: 'Sandra Regina' }),

    // Despesas pagas — este mês
    novaTransacao({ tipo: 'saida', categoria: 'aluguel', descricao: 'Aluguel do galpão', valor: 2400, forma_pagamento: 'transferencia', status: 'pago', data_competencia: diaDoMes(2), data_vencimento: null, data_pagamento: diaDoMes(2), cliente_nome: '' }),
    novaTransacao({ tipo: 'saida', categoria: 'salarios', descricao: 'Salário — equipe', valor: 3400, forma_pagamento: 'transferencia', status: 'pago', data_competencia: diaDoMes(5), data_vencimento: null, data_pagamento: diaDoMes(5), cliente_nome: '' }),
    novaTransacao({ tipo: 'saida', categoria: 'compra_pecas', descricao: 'Reposição de estoque — filtros e óleo', valor: 960, forma_pagamento: 'pix', status: 'pago', data_competencia: diaDoMes(8), data_vencimento: null, data_pagamento: diaDoMes(8), cliente_nome: '' }),
    novaTransacao({ tipo: 'saida', categoria: 'energia', descricao: 'Conta de energia', valor: 410, forma_pagamento: 'debito', status: 'pago', data_competencia: diaDoMes(12), data_vencimento: null, data_pagamento: diaDoMes(12), cliente_nome: '' }),
    novaTransacao({ tipo: 'saida', categoria: 'agua', descricao: 'Conta de água', valor: 140, forma_pagamento: 'debito', status: 'pago', data_competencia: diaDoMes(12), data_vencimento: null, data_pagamento: diaDoMes(12), cliente_nome: '' }),
    novaTransacao({ tipo: 'saida', categoria: 'internet', descricao: 'Internet + telefone', valor: 180, forma_pagamento: 'debito', status: 'pago', data_competencia: diaDoMes(15), data_vencimento: null, data_pagamento: diaDoMes(15), cliente_nome: '' }),

    // A pagar — dentro do prazo
    novaTransacao({ tipo: 'saida', categoria: 'ferramentas', descricao: 'Compressor de ar novo', valor: 1200, forma_pagamento: 'boleto', status: 'pendente', data_competencia: diaDoMes(14), data_vencimento: dataAtras(-5), data_pagamento: null, cliente_nome: '' }),

    // A pagar — vencida
    novaTransacao({ tipo: 'saida', categoria: 'contabilidade', descricao: 'Honorários contábeis', valor: 350, forma_pagamento: 'boleto', status: 'pendente', data_competencia: diaDoMes(20, -1), data_vencimento: dataAtras(3), data_pagamento: null, cliente_nome: '' }),

    // Mês passado — enriquece o preset "Mês passado" / "Últimos 3 meses"
    novaTransacao({ tipo: 'entrada', categoria: 'servicos', descricao: 'Revisão completa — Onix 1.0', valor: 460, forma_pagamento: 'pix', status: 'pago', data_competencia: diaDoMes(9, -1), data_vencimento: null, data_pagamento: diaDoMes(9, -1), cliente_nome: 'Bruno Castro' }),
    novaTransacao({ tipo: 'saida', categoria: 'aluguel', descricao: 'Aluguel do galpão', valor: 2800, forma_pagamento: 'transferencia', status: 'pago', data_competencia: diaDoMes(2, -1), data_vencimento: null, data_pagamento: diaDoMes(2, -1), cliente_nome: '' }),

    // Dois meses atrás — só pra "Últimos 3 meses" não ficar vazio no início
    novaTransacao({ tipo: 'entrada', categoria: 'pecas', descricao: 'Kit de correia dentada', valor: 380, forma_pagamento: 'debito', status: 'pago', data_competencia: diaDoMes(14, -2), data_vencimento: null, data_pagamento: diaDoMes(14, -2), cliente_nome: 'Vinícius Tavares' }),
  ];
}

export function buildSeedCategorias(): Categorias {
  // Mesmas listas fixas do backend (CATEGORIAS_ENTRADA/CATEGORIAS_SAIDA/
  // FORMAS_PAGAMENTO em serializers.py) — só hardcoded aqui porque o front
  // não importa código Python.
  return {
    entrada: ['servicos', 'pecas', 'acessorios', 'outros'],
    saida: ['aluguel', 'energia', 'agua', 'internet', 'salarios', 'contabilidade', 'compra_pecas', 'ferramentas', 'equipamentos', 'manutencao', 'impostos', 'marketing', 'taxas', 'outros'],
    formas_pagamento: ['pix', 'dinheiro', 'debito', 'credito', 'boleto', 'transferencia'],
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Transações "do período" — mesmo filtro que GET /financeiro/transacoes aplica. */
export function filtrarSeedPorPeriodo(todas: Transacao[], de: string, ate: string): Transacao[] {
  return todas.filter(r => r.data_competencia >= de && r.data_competencia <= ate);
}

/** Espelha o cálculo de GET /financeiro/resumo (orders/financeiro_views.py)
 *  em cima dos dados de demonstração, pra os KPIs baterem com a lista de
 *  transações e com os widgets derivados dela. */
export function buildSeedResumo(todas: Transacao[], de: string, ate: string, verMargem: boolean): ResumoFinanceiro {
  const doPeriodo = filtrarSeedPorPeriodo(todas, de, ate);
  const hoje = hojeLocal();

  const faturamento = doPeriodo.filter(r => r.tipo === 'entrada').reduce((s, r) => s + r.valor, 0);
  const despesas = doPeriodo.filter(r => r.tipo === 'saida').reduce((s, r) => s + r.valor, 0);
  const recebido = doPeriodo.filter(r => r.tipo === 'entrada' && r.status === 'pago').reduce((s, r) => s + r.valor, 0);
  const saidasPagas = doPeriodo.filter(r => r.tipo === 'saida' && r.status === 'pago').reduce((s, r) => s + r.valor, 0);

  // a_receber/a_pagar/vencido são dívida em aberto AGORA — não um corte do
  // período (mesma regra do backend: calculados sobre "todas", não sobre
  // "do_periodo").
  const pendentes = todas.filter(r => r.status === 'pendente');
  const aReceber = pendentes.filter(r => r.tipo === 'entrada').reduce((s, r) => s + r.valor, 0);
  const aPagar = pendentes.filter(r => r.tipo === 'saida').reduce((s, r) => s + r.valor, 0);
  const vencidoReceber = pendentes.filter(r => r.tipo === 'entrada' && r.data_vencimento && r.data_vencimento < hoje).reduce((s, r) => s + r.valor, 0);
  const vencidoPagar = pendentes.filter(r => r.tipo === 'saida' && r.data_vencimento && r.data_vencimento < hoje).reduce((s, r) => s + r.valor, 0);

  const resumo: ResumoFinanceiro = {
    faturamento: round2(faturamento),
    despesas: round2(despesas),
    recebido: round2(recebido),
    saldo: round2(recebido - saidasPagas),
    a_receber: round2(aReceber),
    a_pagar: round2(aPagar),
    vencido_receber: round2(vencidoReceber),
    vencido_pagar: round2(vencidoPagar),
  };
  if (verMargem) {
    const lucro = faturamento - despesas;
    resumo.lucro = round2(lucro);
    resumo.margem_percentual = faturamento > 0 ? round2((lucro / faturamento) * 100) : 0;
  }
  return resumo;
}

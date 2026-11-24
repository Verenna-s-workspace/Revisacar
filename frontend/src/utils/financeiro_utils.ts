// ── Datas no calendário local ───────────────────────────────────────────────

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

// ── Período do Financeiro ───────────────────────────────────────────────────
// Semana = domingo a sábado (a mesma da Agenda). Trimestre = trimestre CIVIL
// atual (jan–mar, abr–jun, jul–set, out–dez). "Última semana" = a semana
// completa anterior, como "Mês passado" é o mês completo anterior.

export type PeriodoId = 'este-mes' | 'mes-passado' | 'esta-semana' | 'ultima-semana' | 'trimestre' | 'personalizado';

export interface PeriodoSel {
  id: PeriodoId;
  /** Só no personalizado: "YYYY-MM-DD". */
  de?: string;
  ate?: string;
}

export const PERIODO_PADRAO: PeriodoSel = { id: 'este-mes' };

export const ROTULO_PERIODO: Record<PeriodoId, string> = {
  'este-mes': 'Este mês',
  'mes-passado': 'Mês passado',
  'esta-semana': 'Esta semana',
  'ultima-semana': 'Última semana',
  'trimestre': 'Trimestre',
  'personalizado': 'Período personalizado',
};

export const ORDEM_PERIODOS: PeriodoId[] = ['este-mes', 'mes-passado', 'esta-semana', 'ultima-semana', 'trimestre', 'personalizado'];

/** Mesmo limite do backend (MAX_DIAS_PERIODO em financeiro_views.py). */
export const MAX_DIAS_PERIODO = 800;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "YYYY-MM-DD" → Date à meia-noite LOCAL (new Date("YYYY-MM-DD") seria UTC e voltaria um dia no Brasil). */
export function dataDeIso(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function somarDias(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function inicioDaSemana(d: Date): Date {
  return somarDias(d, -d.getDay());
}

/** Dias entre duas datas ISO, contando as duas pontas (mesmo dia = 1). */
export function diasNoPeriodo(de: string, ate: string): number {
  return Math.round((dataDeIso(ate).getTime() - dataDeIso(de).getTime()) / 86_400_000) + 1;
}

/** Datas (YYYY-MM-DD, calendário local) de um período. */
export function resolverPeriodo(sel: PeriodoSel, hoje: Date = new Date()): { de: string; ate: string } {
  const a = hoje.getFullYear();
  const m = hoje.getMonth();
  switch (sel.id) {
    case 'mes-passado':
      return { de: isoLocal(new Date(a, m - 1, 1)), ate: isoLocal(new Date(a, m, 0)) };
    case 'esta-semana': {
      const ini = inicioDaSemana(hoje);
      return { de: isoLocal(ini), ate: isoLocal(somarDias(ini, 6)) };
    }
    case 'ultima-semana': {
      const ini = somarDias(inicioDaSemana(hoje), -7);
      return { de: isoLocal(ini), ate: isoLocal(somarDias(ini, 6)) };
    }
    case 'trimestre': {
      const q = Math.floor(m / 3) * 3;
      return { de: isoLocal(new Date(a, q, 1)), ate: isoLocal(new Date(a, q + 3, 0)) };
    }
    case 'personalizado':
      if (sel.de && sel.ate) return { de: sel.de, ate: sel.ate };
      // Sem datas válidas cai no mês atual (o modal só deixa aplicar com as duas).
      return { de: isoLocal(new Date(a, m, 1)), ate: isoLocal(new Date(a, m + 1, 0)) };
    default:
      return { de: isoLocal(new Date(a, m, 1)), ate: isoLocal(new Date(a, m + 1, 0)) };
  }
}

/** Mensagem de erro do intervalo personalizado, ou null se estiver ok. */
export function validarIntervalo(de: string, ate: string): string | null {
  if (!de || !ate) return 'Informe a data inicial e a data final.';
  if (Number.isNaN(dataDeIso(de).getTime()) || Number.isNaN(dataDeIso(ate).getTime())) return 'Data inválida.';
  if (de > ate) return 'A data inicial não pode ser depois da data final.';
  if (diasNoPeriodo(de, ate) > MAX_DIAS_PERIODO) return `O período pode ter no máximo ${MAX_DIAS_PERIODO} dias.`;
  return null;
}

/** "2026-11-05" → "05/11/2026". */
export function dataCompleta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "2026-11-05" → "05/11". */
export function diaMes(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "17/11 a 23/11" (ou com o ano, se cruzar anos / se `comAno`). */
export function intervaloCurto(de: string, ate: string, comAno = false): string {
  const cruza = de.slice(0, 4) !== ate.slice(0, 4);
  return comAno || cruza ? `${dataCompleta(de)} a ${dataCompleta(ate)}` : `${diaMes(de)} a ${diaMes(ate)}`;
}

/** "Novembro de 2026" para um mês inteiro; senão o intervalo "01/10 a 31/12". */
export function descreverPeriodo(sel: PeriodoSel, hoje: Date = new Date()): string {
  const { de, ate } = resolverPeriodo(sel, hoje);
  const mesCheio = de.slice(0, 7) === ate.slice(0, 7) && de.endsWith('-01') && dataDeIso(ate).getDate() === new Date(dataDeIso(de).getFullYear(), dataDeIso(de).getMonth() + 1, 0).getDate();
  if (mesCheio) {
    const d = dataDeIso(de);
    return `${MESES[d.getMonth()][0].toUpperCase()}${MESES[d.getMonth()].slice(1)} de ${d.getFullYear()}`;
  }
  return intervaloCurto(de, ate, true);
}

// ── Fluxo de caixa agrupado ─────────────────────────────────────────────────

export type Granularidade = 'dia' | 'semana' | 'mes';

export interface PontoFluxo {
  chave: string;
  /** Rótulo do eixo X. */
  rotulo: string;
  /** Texto do tooltip ("02/11 a 08/11"). */
  detalhe: string;
  entradas: number;
  saidas: number;
}

interface LinhaFluxo {
  tipo: 'entrada' | 'saida';
  valor: number;
  valor_liquido?: number;
  data_competencia: string;
}

/** Até 8 dias → por dia; até 45 → por semana; mais que isso → por mês. */
export function granularidadeDoPeriodo(de: string, ate: string): Granularidade {
  const dias = diasNoPeriodo(de, ate);
  if (dias <= 8) return 'dia';
  if (dias <= 45) return 'semana';
  return 'mes';
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/**
 * Agrupa os lançamentos do período em barras. Intervalos sem movimento entram com zero
 * (o eixo fica contínuo). Entrada conta pelo LÍQUIDO (o que caiu na conta, sem a taxa da maquininha).
 */
export function fluxoDeCaixa(linhas: LinhaFluxo[], de: string, ate: string): { granularidade: Granularidade; pontos: PontoFluxo[] } {
  const gran = granularidadeDoPeriodo(de, ate);
  const inicio = dataDeIso(de);
  const fim = dataDeIso(ate);
  const pontos: PontoFluxo[] = [];

  if (gran === 'dia') {
    for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
      const iso = isoLocal(d);
      pontos.push({ chave: iso, rotulo: diaMes(iso), detalhe: `${DIAS_SEMANA[d.getDay()]}, ${dataCompleta(iso)}`, entradas: 0, saidas: 0 });
    }
  } else if (gran === 'semana') {
    for (let ini = inicioDaSemana(inicio); ini <= fim; ini = somarDias(ini, 7)) {
      const ponta = somarDias(ini, 6);
      const a = isoLocal(ini < inicio ? inicio : ini);
      const b = isoLocal(ponta > fim ? fim : ponta);
      pontos.push({ chave: isoLocal(ini), rotulo: diaMes(a), detalhe: intervaloCurto(a, b), entradas: 0, saidas: 0 });
    }
  } else {
    for (let d = new Date(inicio.getFullYear(), inicio.getMonth(), 1); d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      pontos.push({
        chave: isoLocal(d).slice(0, 7),
        rotulo: `${MESES_CURTOS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        detalhe: `${MESES[d.getMonth()]} de ${d.getFullYear()}`,
        entradas: 0, saidas: 0,
      });
    }
  }

  const porChave = new Map(pontos.map(p => [p.chave, p]));
  for (const l of linhas) {
    const dia = dataDeIso(l.data_competencia);
    const chave = gran === 'dia' ? l.data_competencia : gran === 'semana' ? isoLocal(inicioDaSemana(dia)) : l.data_competencia.slice(0, 7);
    const ponto = porChave.get(chave);
    if (!ponto) continue;
    if (l.tipo === 'entrada') ponto.entradas += l.valor_liquido ?? l.valor;
    else ponto.saidas += l.valor;
  }
  for (const p of pontos) { p.entradas = arredondar(p.entradas); p.saidas = arredondar(p.saidas); }
  return { granularidade: gran, pontos };
}

// ── Filtros dos lançamentos ─────────────────────────────────────────────────

export interface FiltrosLancamentos {
  tipo: 'todos' | 'entrada' | 'saida';
  /** "pendente" = em aberto e ainda no prazo; "vencido" = em aberto e atrasado (como o selo da tabela). */
  status: 'todos' | 'pago' | 'pendente' | 'vencido';
  /** Chaves "tipo:categoria" (ex.: "saida:aluguel") — "outros" existe nos dois tipos. */
  categorias: string[];
  formas: string[];
  origem: 'todas' | 'os' | 'manual';
  /** Data de competência (a coluna "Data" da tabela). '' = sem limite. */
  de: string;
  ate: string;
  /** Faixa do valor BRUTO, em reais ('' = sem limite). */
  valorMin: string;
  valorMax: string;
}

export const FILTROS_VAZIOS: FiltrosLancamentos = {
  tipo: 'todos', status: 'todos', categorias: [], formas: [], origem: 'todas', de: '', ate: '', valorMin: '', valorMax: '',
};

export const chaveCategoria = (tipo: 'entrada' | 'saida', categoria: string) => `${tipo}:${categoria}`;

/** Quantos critérios estão ligados (vira o contador do botão Filtros). */
export function contarFiltrosAtivos(f: FiltrosLancamentos): number {
  let n = 0;
  if (f.tipo !== 'todos') n++;
  if (f.status !== 'todos') n++;
  if (f.categorias.length) n++;
  if (f.formas.length) n++;
  if (f.origem !== 'todas') n++;
  if (f.de || f.ate) n++;
  if (f.valorMin || f.valorMax) n++;
  return n;
}

/** Minúsculas e sem acento, pra "ola" achar "Olá". */
export function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filtrarLancamentos<T extends {
  tipo: 'entrada' | 'saida'; categoria: string; descricao: string; cliente_nome: string; valor: number;
  status: string; vencido: boolean; forma_pagamento: string | null; data_competencia: string; ordem_servico_id: string | null;
}>(lista: T[], f: FiltrosLancamentos, busca: string, rotuloCategoria: (tipo: 'entrada' | 'saida', categoria: string) => string): T[] {
  const termo = normalizarTexto(busca.trim());
  const min = f.valorMin !== '' ? Number(f.valorMin) : null;
  const max = f.valorMax !== '' ? Number(f.valorMax) : null;
  return lista.filter(t => {
    if (f.tipo !== 'todos' && t.tipo !== f.tipo) return false;
    if (f.status === 'pago' && t.status !== 'pago') return false;
    if (f.status === 'pendente' && !(t.status === 'pendente' && !t.vencido)) return false;
    if (f.status === 'vencido' && !t.vencido) return false;
    if (f.categorias.length && !f.categorias.includes(chaveCategoria(t.tipo, t.categoria))) return false;
    if (f.formas.length && !(t.forma_pagamento && f.formas.includes(t.forma_pagamento))) return false;
    if (f.origem === 'os' && !t.ordem_servico_id) return false;
    if (f.origem === 'manual' && t.ordem_servico_id) return false;
    if (f.de && t.data_competencia < f.de) return false;
    if (f.ate && t.data_competencia > f.ate) return false;
    if (min !== null && Number.isFinite(min) && t.valor < min) return false;
    if (max !== null && Number.isFinite(max) && t.valor > max) return false;
    if (termo && !normalizarTexto(`${t.descricao} ${t.cliente_nome} ${rotuloCategoria(t.tipo, t.categoria)}`).includes(termo)) return false;
    return true;
  });
}

// ── Exportação (CSV) ────────────────────────────────────────────────────────

const reais = (n: number) => n.toFixed(2).replace('.', ',');

/** Texto vindo de usuário/cliente que começa com = + - @ viraria fórmula no Excel: ganha um apóstrofo na frente. */
function celula(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export interface LinhaCsv {
  tipo: 'entrada' | 'saida'; categoria: string; descricao: string; cliente_nome: string; valor: number; taxa: number;
  valor_liquido: number; status: string; vencido: boolean; forma_pagamento: string | null; data_competencia: string;
  data_vencimento: string | null; data_pagamento: string | null;
}

/** CSV pronto pro Excel brasileiro: separador ";", decimal com vírgula, BOM UTF-8 e quebra CRLF. */
export function lancamentosParaCsv(
  lista: LinhaCsv[],
  rotuloCategoria: (tipo: 'entrada' | 'saida', categoria: string) => string,
  rotuloForma: (forma: string) => string,
  rotuloStatus: (status: string) => string,
): string {
  const cab = ['Data', 'Descrição', 'Cliente', 'Tipo', 'Categoria', 'Status', 'Forma de pagamento', 'Valor', 'Taxa', 'Líquido', 'Vencimento', 'Pagamento'];
  const linhas = lista.map(t => [
    dataCompleta(t.data_competencia),
    t.descricao,
    t.cliente_nome,
    t.tipo === 'entrada' ? 'Entrada' : 'Saída',
    rotuloCategoria(t.tipo, t.categoria),
    t.vencido ? 'Vencido' : rotuloStatus(t.status),
    t.forma_pagamento ? rotuloForma(t.forma_pagamento) : '',
    reais(t.valor),
    t.tipo === 'entrada' ? reais(t.taxa) : '',
    t.tipo === 'entrada' ? reais(t.valor_liquido) : '',
    t.data_vencimento ? dataCompleta(t.data_vencimento) : '',
    t.data_pagamento ? dataCompleta(t.data_pagamento) : '',
  ].map(c => celula(String(c))).join(';'));
  return '﻿' + [cab.join(';'), ...linhas].join('\r\n');
}

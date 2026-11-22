import type { Agendamento, AppointmentStatus } from '../../../types/agendamento';
import {
  addDays,
  MONTHS,
  parseISODate,
  timeToMinutes,
  toISODate,
  WEEKDAYS_LONG,
} from '../../../utils/agenda';

/**
 * Paleta de cada status de agendamento = paleta de status da OS (Ordens/Status.css).
 * A classe só define as variáveis --st-bg / --st-borda / --st-ponto / --st-texto.
 * Mesma correspondência já usada em Clientes (agendado → aprovada, pronto → finalizada…).
 * `ag-tom-neutro` (agendamentosDesktop.css) é o cinza padrão, para quem não tem par na OS.
 */
export const CLASSE_STATUS: Record<AppointmentStatus, string> = {
  pendente: 'os-status--pendente_aprovacao',
  agendado: 'os-status--aprovada',
  em_andamento: 'os-status--em_execucao',
  aguardando_pagamento: 'os-status--aguardando',
  pronto_retirada: 'os-status--finalizada',
  concluido: 'os-status--finalizada',
  cancelado: 'ag-tom-neutro',
  recusado: 'os-status--recusada',
};

export const plural = (n: number, singular: string, pluralTxt: string) => (n === 1 ? singular : pluralTxt);

// ── Semana (segunda a domingo, como no Figma: Seg 16 … Sáb 21) ───────────────

export const inicioDaSemana = (data: Date): Date => {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  const deslocamento = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - deslocamento);
  return d;
};

export const diasDaSemana = (data: Date): Date[] => {
  const inicio = inicioDaSemana(data);
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
};

/** Matriz de semanas (segunda a domingo) que cobre o mês inteiro. */
export const matrizDoMes = (ano: number, mes: number): Date[][] => {
  const inicio = inicioDaSemana(new Date(ano, mes, 1));
  const ultimo = new Date(ano, mes + 1, 0);
  const semanas: Date[][] = [];
  let cursor = inicio;
  while (cursor <= ultimo) {
    semanas.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return semanas;
};

export const SEMANA_CURTA_SEG = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const mesExtenso = (d: Date) => MONTHS[d.getMonth()].toLowerCase();

/** "16 a 21 de novembro" · "30 de novembro a 5 de dezembro" */
export function rotuloIntervalo(inicio: Date, fim: Date): string {
  if (inicio.getFullYear() !== fim.getFullYear()) {
    return `${inicio.getDate()} de ${mesExtenso(inicio)} de ${inicio.getFullYear()} a ${fim.getDate()} de ${mesExtenso(fim)} de ${fim.getFullYear()}`;
  }
  if (inicio.getMonth() !== fim.getMonth()) {
    return `${inicio.getDate()} de ${mesExtenso(inicio)} a ${fim.getDate()} de ${mesExtenso(fim)}`;
  }
  return `${inicio.getDate()} a ${fim.getDate()} de ${mesExtenso(fim)}`;
}

/** "terça-feira, 17 de novembro" */
export const rotuloDia = (d: Date) => `${WEEKDAYS_LONG[d.getDay()].toLowerCase()}, ${d.getDate()} de ${mesExtenso(d)}`;

/** "novembro de 2026" */
export const rotuloMes = (d: Date) => `${mesExtenso(d)} de ${d.getFullYear()}`;

// ── Grade de horários (Grid de linhas de 15 min) ─────────────────────────────

export const LINHAS_POR_HORA = 4;
const MIN_POR_LINHA = 60 / LINHAS_POR_HORA;
const MAX_FAIXAS = 4; // agendamentos simultâneos lado a lado; acima disso eles se sobrepõem

export interface EventoNaGrade {
  ag: Agendamento;
  /** Linha inicial da grade (1 = abertura). */
  linha: number;
  /** Quantas linhas de 15 min ocupa. */
  span: number;
  /** Coluna inicial / largura dentro do dia (o dia tem `colunas` subcolunas). */
  colIni: number;
  colSpan: number;
}

const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
const mmc = (a: number, b: number) => (a * b) / mdc(a, b);

/**
 * Posiciona os agendamentos de UM dia na grade.
 * - Linhas de 15 min: início e fim são arredondados para a linha mais próxima por fora.
 * - Simultâneos dividem a largura do dia; quem não tem concorrente usa a largura toda.
 * - O que cai inteiro fora do horário de funcionamento não entra na grade (conta em `fora`).
 */
export function posicionarEventosDoDia(
  lista: Agendamento[],
  aberturaMin: number,
  totalHoras: number,
): { eventos: EventoNaGrade[]; colunas: number; fora: number } {
  const fechamentoMin = aberturaMin + totalHoras * 60;
  const totalLinhas = totalHoras * LINHAS_POR_HORA;
  let fora = 0;

  const itens = lista
    .map(ag => {
      const ini = timeToMinutes(ag.horaInicio);
      let fim = timeToMinutes(ag.horaFim);
      if (fim <= ini) fim = ini + 30;
      return { ag, ini, fim };
    })
    .filter(it => {
      const visivel = it.fim > aberturaMin && it.ini < fechamentoMin;
      if (!visivel) fora++;
      return visivel;
    })
    .map(it => {
      const iniV = Math.max(it.ini, aberturaMin);
      const fimV = Math.min(it.fim, fechamentoMin);
      const linha = Math.floor((iniV - aberturaMin) / MIN_POR_LINHA) + 1;
      const fimLinha = Math.ceil((fimV - aberturaMin) / MIN_POR_LINHA) + 1;
      const span = Math.max(1, Math.min(Math.max(fimLinha - linha, 2), totalLinhas + 1 - linha));
      return { ag: it.ag, linha, span };
    })
    .sort((a, b) => a.linha - b.linha || b.span - a.span);

  // Agrupa os que se sobrepõem e distribui cada grupo em faixas.
  const grupos: { itens: typeof itens; faixas: number[]; faixaDe: number[]; fim: number }[] = [];
  for (const it of itens) {
    let g = grupos[grupos.length - 1];
    if (!g || it.linha >= g.fim) {
      g = { itens: [], faixas: [], faixaDe: [], fim: 0 };
      grupos.push(g);
    }
    let faixa = g.faixas.findIndex(fimFaixa => fimFaixa <= it.linha);
    if (faixa === -1) {
      if (g.faixas.length < MAX_FAIXAS) {
        g.faixas.push(0);
        faixa = g.faixas.length - 1;
      } else {
        faixa = g.faixas.indexOf(Math.min(...g.faixas));
      }
    }
    g.faixas[faixa] = it.linha + it.span;
    g.itens.push(it);
    g.faixaDe.push(faixa);
    g.fim = Math.max(g.fim, it.linha + it.span);
  }

  const colunas = grupos.reduce((acc, g) => mmc(acc, Math.max(g.faixas.length, 1)), 1);
  const eventos: EventoNaGrade[] = [];
  for (const g of grupos) {
    const k = Math.max(g.faixas.length, 1);
    const largura = colunas / k;
    g.itens.forEach((it, i) => {
      eventos.push({ ag: it.ag, linha: it.linha, span: it.span, colIni: g.faixaDe[i] * largura + 1, colSpan: largura });
    });
  }
  return { eventos, colunas, fora };
}

// ── Ordem da lista ───────────────────────────────────────────────────────────

/** Próximos primeiro (do mais perto para o mais longe), depois os passados (do mais recente para o mais antigo). */
export function ordenarParaLista(lista: Agendamento[]): Agendamento[] {
  const hoje = toISODate(new Date());
  const chave = (a: Agendamento) => `${a.data} ${a.horaInicio}`;
  const proximos = lista.filter(a => a.data >= hoje).sort((a, b) => chave(a).localeCompare(chave(b)));
  const passados = lista.filter(a => a.data < hoje).sort((a, b) => chave(b).localeCompare(chave(a)));
  return [...proximos, ...passados];
}

export const dataCurta = (iso: string) => {
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

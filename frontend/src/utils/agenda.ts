// ── Agenda: utilitários de data e horário ────────────────────────────────────
// Funções puras usadas pelas views Mensal/Semanal/Diário e pelos modais de
// agendamento. Datas são sempre tratadas em horário local (sem fuso) usando o
// formato ISO simples 'YYYY-MM-DD' para evitar problemas de timezone do
// `new Date(string)`.

const pad2 = (v: number) => String(v).padStart(2, '0');

/** Converte um Date para 'YYYY-MM-DD' (local). */
export const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Converte 'YYYY-MM-DD' para Date local (00:00). */
export const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const isSameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const isToday = (date: Date): boolean => isSameDay(date, new Date());

export const addDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

export const addMonths = (date: Date, n: number): Date => {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1);
  return d;
};

export const addYears = (date: Date, n: number): Date =>
  new Date(date.getFullYear() + n, date.getMonth(), 1);

/** Domingo da semana que contém `date`. */
export const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
};

/** Os 7 dias (Dom–Sáb) da semana que contém `date`. */
export const getWeekDates = (date: Date): Date[] => {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/**
 * Matriz de semanas (cada uma com 7 dias, Dom–Sáb) cobrindo o mês inteiro,
 * incluindo dias de preenchimento do mês anterior/seguinte.
 */
export const getMonthMatrix = (year: number, month: number): Date[][] => {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const start = startOfWeek(firstOfMonth);
  const end = startOfWeek(lastOfMonth);

  const weeks: Date[][] = [];
  let cursor = start;
  while (cursor <= end) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
};

// ── Labels em pt-BR ───────────────────────────────────────────────────────────

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export const MONTHS_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

/** Ex.: "Terça-feira, 15 de Outubro de 2024" */
export const formatLongDate = (iso: string): string => {
  const d = parseISODate(iso);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
};

/** Ex.: "15 de Outubro" */
export const formatDayMonth = (date: Date): string =>
  `${date.getDate()} de ${MONTHS[date.getMonth()]}`;

/** Ex.: "15/10/2024" */
export const formatDateBR = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ── Horário ───────────────────────────────────────────────────────────────────

export const timeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

export const formatTimeRange = (inicio: string, fim: string): string =>
  `${inicio} - ${fim}`;

/** Duração padrão (min) de um novo agendamento ao escolher um horário. */
export const DEFAULT_DURATION_MINUTES = 60;

/** Horário de funcionamento padrão usado antes de qualquer configuração
 * explícita nas Configurações (mantém o comportamento atual: 08:00–19:00). */
export const DEFAULT_HORA_ABERTURA = '08:00';
export const DEFAULT_HORA_FECHAMENTO = '19:00';

/** Horas inteiras cobrindo o expediente — usado pra desenhar a grade lateral
 * das views Diária/Semanal. Arredonda pra fora (floor/ceil) pra garantir que
 * o expediente inteiro caiba na grade mesmo se abertura/fechamento não forem
 * em hora cheia (ex.: 08:30). */
export function getAgendaHours(horaAbertura: string, horaFechamento: string): number[] {
  const startH = Math.floor(timeToMinutes(horaAbertura) / 60);
  const endH = Math.ceil(timeToMinutes(horaFechamento) / 60);
  const length = Math.max(endH - startH, 1);
  return Array.from({ length }, (_, i) => startH + i);
}

/** Slots de horário pra seleção de agendamento — do horário de abertura até
 * o de fechamento, em intervalos de `intervalMinutes` (padrão: a duração
 * padrão de um agendamento). Nunca gera um slot que ultrapasse o
 * fechamento — a última opção sempre termina até o horário configurado. */
export function getTimeSlots(
  horaAbertura: string,
  horaFechamento: string,
  intervalMinutes: number = DEFAULT_DURATION_MINUTES,
): string[] {
  const start = timeToMinutes(horaAbertura);
  const end = timeToMinutes(horaFechamento);
  const slots: string[] = [];
  for (let t = start; t + intervalMinutes <= end; t += intervalMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

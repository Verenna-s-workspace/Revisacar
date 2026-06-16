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

/** Janela de funcionamento exibida na agenda (08:00 às 19:00). */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 19;

/** Horas inteiras exibidas na lateral das views Diária/Semanal. */
export const AGENDA_HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);

/** Slots de 1h usados para seleção de horário (ex.: '08:00', '09:00', ...). */
export const TIME_SLOTS: string[] = AGENDA_HOURS.map(h => `${pad2(h)}:00`);

/** Duração padrão (min) de um novo agendamento ao escolher um horário. */
export const DEFAULT_DURATION_MINUTES = 60;

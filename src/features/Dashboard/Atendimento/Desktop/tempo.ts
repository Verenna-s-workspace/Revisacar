/** "45 min" · "1 h 20" · "4 h" · "1 dia" · "2 dias" — duração calculada, nunca cronometrada. */
export function duracaoCurta(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}

/** Tempo decorrido desde `iso` até `agora` (ms); null se a data for inválida. */
export function decorridoMs(iso: string | null | undefined, agora: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, agora - t);
}

function minutosDoDia(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/** Duração prevista (min) de um agendamento: horaFim − horaInicio. null se não der pra calcular. */
export function previsaoEmMinutos(horaInicio: string, horaFim: string): number | null {
  const i = minutosDoDia(horaInicio);
  const f = minutosDoDia(horaFim);
  return i !== null && f !== null && f > i ? f - i : null;
}

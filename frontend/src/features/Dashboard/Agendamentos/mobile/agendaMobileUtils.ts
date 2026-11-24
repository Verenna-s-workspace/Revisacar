import type { Agendamento } from '../../../../types/agendamento';
import { toISODate, WEEKDAYS_LONG } from '../../../../utils/agenda';
import { diasDaSemana, plural } from '../agendamentosDesktopUtils';

/** "novembro de 2026" → "Novembro de 2026" (o Figma mostra o mês com inicial maiúscula). */
export const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Terça", "Sábado" — nome do dia sem "-feira", como no Figma ("Terça, 17"). */
export const nomeDiaCurto = (d: Date) => WEEKDAYS_LONG[d.getDay()].split('-')[0];

/** "3 agendamentos" · "1 agendamento" · "0 agendamentos". */
export const contagem = (n: number) => `${n} ${plural(n, 'agendamento', 'agendamentos')}`;

/** "Terça, 17 · 3 agendamentos" */
export const rotuloSecaoDia = (d: Date, n: number) => `${nomeDiaCurto(d)}, ${d.getDate()} · ${contagem(n)}`;

/**
 * Dias que a tira mostra: segunda a sábado; o domingo só aparece quando é hoje, é o dia aberto
 * ou tem agendamento (mesma regra do desktop, que mantém essa conta dentro do próprio componente).
 */
export function diasDaTira(referencia: Date, agendamentos: Agendamento[], diaAberto?: Date): Date[] {
  const sete = diasDaSemana(referencia);
  const iso = toISODate(sete[6]);
  const mostraDomingo =
    iso === toISODate(new Date()) ||
    (diaAberto !== undefined && iso === toISODate(diaAberto)) ||
    agendamentos.some(a => a.data === iso);
  return mostraDomingo ? sete : sete.slice(0, 6);
}

/** Agendamentos agrupados por data (YYYY-MM-DD), cada grupo em ordem de horário. */
export function agruparPorDia(agendamentos: Agendamento[]): Map<string, Agendamento[]> {
  const mapa = new Map<string, Agendamento[]>();
  for (const ag of agendamentos) {
    const lista = mapa.get(ag.data);
    if (lista) lista.push(ag);
    else mapa.set(ag.data, [ag]);
  }
  mapa.forEach(lista => lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
  return mapa;
}

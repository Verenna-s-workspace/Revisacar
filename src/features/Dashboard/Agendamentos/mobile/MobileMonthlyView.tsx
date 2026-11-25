import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { AgendaIcons } from '../icons';
import { Icons } from '../../Icons';
import { MOBILE_STATUS, DAY_STATUS_PRIORITY, statusVars } from './statusTheme';
import { APPOINTMENT_STATUS_CONFIG } from '../StatusBadge';
import {
  getMonthMatrix, toISODate, addMonths, WEEKDAYS_SHORT, WEEKDAYS_LONG, MONTHS,
} from '../../../../utils/agenda';
import type { Agendamento, AppointmentStatus } from '../../../../types/agendamento';

interface MobileMonthlyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (d: Date) => void;
  /** Chamado ao tocar em um dia com agendamentos → o pai abre a visão Diária. */
  onDayClick: (d: Date) => void;
}



export function MobileMonthlyView({ date, agendamentos, onDateChange, onDayClick }: MobileMonthlyViewProps) {
  const todayISO = toISODate(new Date());
  const year = date.getFullYear();
  const month = date.getMonth();
  const matrix = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const byDay = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    agendamentos.forEach(a => {
      if (!map[a.data]) map[a.data] = [];
      map[a.data].push(a);
    });
    return map;
  }, [agendamentos]);

  // Legenda: só as cores que realmente aparecem no mês exibido.
  const legend = useMemo(() => {
    const used = new Set<AppointmentStatus>();
    matrix.flat().forEach(day => {
      if (day.getMonth() !== month) return;
      const items = byDay[toISODate(day)] ?? [];
      if (items.length === 0) return;
      const active = items.filter(a => a.status !== 'cancelado' && a.status !== 'recusado');
      used.add(DAY_STATUS_PRIORITY.find(st => active.some(a => a.status === st)) ?? 'cancelado');
    });
    return [...DAY_STATUS_PRIORITY, 'cancelado' as AppointmentStatus].filter(st => used.has(st));
  }, [matrix, byDay, month]);

  return (
    <div className="agm-view">
      <section className="agm-nav" aria-label="Navegação por mês">
        <button type="button" className="agm-iconbtn agm-iconbtn--sm" aria-label="Mês anterior" onClick={() => onDateChange(addMonths(date, -1))}>
          {Icons.chevL}
        </button>
        <div className="agm-nav__center">
          <h2 className="agm-nav__title">{MONTHS[month]}<small>{year}</small></h2>
        </div>
        <button type="button" className="agm-pill" onClick={() => onDateChange(new Date())}>Hoje</button>
        <button type="button" className="agm-iconbtn agm-iconbtn--sm" aria-label="Próximo mês" onClick={() => onDateChange(addMonths(date, 1))}>
          {AgendaIcons.chevR}
        </button>
      </section>

      <section className="agm-cal" aria-label={`Calendário de ${MONTHS[month]} de ${year}`}>
        <div className="agm-cal__head" aria-hidden="true">
          {WEEKDAYS_SHORT.map((w, i) => (
            <div key={w} className={`agm-cal__wd${i === 0 || i === 6 ? ' is-weekend' : ''}`}>{w}</div>
          ))}
        </div>
        <div className="agm-cal__grid">
          {matrix.flat().map(day => {
            const iso = toISODate(day);
            const inMonth = day.getMonth() === month;
            const items = byDay[iso] ?? [];
            const active = items.filter(a => a.status !== 'cancelado' && a.status !== 'recusado');
            const hasItems = inMonth && items.length > 0;
            const isToday = iso === todayISO;

            // Cor dominante do dia (ou a de cancelado, se só houver cancelados).
            const dominant = DAY_STATUS_PRIORITY.find(s => active.some(a => a.status === s)) ?? 'cancelado';
            const count = active.length > 0 ? active.length : items.length;

            const cls = ['agm-day', !inMonth ? 'is-out' : '', hasItems ? 'has-items' : '', isToday ? 'is-today' : '']
              .filter(Boolean).join(' ');

            return (
              <button
                key={iso}
                type="button"
                className={cls}
                disabled={!hasItems}
                aria-current={isToday ? 'date' : undefined}
                aria-label={
                  `${WEEKDAYS_LONG[day.getDay()]}, ${day.getDate()} de ${MONTHS[day.getMonth()]}` +
                  (hasItems ? `, ${count} agendamento${count !== 1 ? 's' : ''}` : ', sem agendamentos')
                }
                onClick={() => hasItems && onDayClick(day)}
              >
                <span>{day.getDate()}</span>
                {hasItems && (
                  <span className="agm-day__badge" style={statusVars(dominant) as CSSProperties}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="agm-legend" aria-label="Legenda das cores">
        {legend.map(st => (
          <span key={st} className="agm-legend__item" style={{ '--dot': MOBILE_STATUS[st].stripe } as CSSProperties}>
            {APPOINTMENT_STATUS_CONFIG[st].label}
          </span>
        ))}
        <span className="agm-legend__item" style={{ '--dot': '#C82319' } as CSSProperties}>Hoje</span>
        <span style={{ flexBasis: '100%' }}>O número indica os agendamentos do dia.</span>
      </div>
    </div>
  );
}

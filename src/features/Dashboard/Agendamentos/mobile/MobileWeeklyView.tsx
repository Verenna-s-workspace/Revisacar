import { useMemo } from 'react';
import { Icons } from '../../Icons';
import { AgendaIcons } from '../icons';
import { MobileAppointmentCard } from './MobileAppointmentCard';
import {
  toISODate, addDays, getWeekDates, WEEKDAYS_SHORT, WEEKDAYS_LONG, MONTHS, MONTHS_SHORT,
} from '../../../../utils/agenda';
import type { Agendamento } from '../../../../types/agendamento';

interface MobileWeeklyViewProps {
  /** Dia selecionado — a semana exibida é a que contém esta data. */
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (d: Date) => void;
  onCardClick: (ag: Agendamento) => void;
  onNew: (isoDate: string) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}

export function MobileWeeklyView({
  date, agendamentos, onDateChange, onCardClick, onNew, hasFilters, onClearFilters,
}: MobileWeeklyViewProps) {
  const todayISO = toISODate(new Date());
  const selectedISO = toISODate(date);
  const weekDates = useMemo(() => getWeekDates(date), [date]);
  const first = weekDates[0];
  const last = weekDates[6];

  const byDay = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    weekDates.forEach(d => { map[toISODate(d)] = []; });
    agendamentos.forEach(a => { if (map[a.data]) map[a.data].push(a); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
    return map;
  }, [agendamentos, weekDates]);

  const weekTotal = Object.values(byDay).reduce((n, arr) => n + arr.length, 0);
  const dayItems = byDay[selectedISO] ?? [];
  const emAndamento = dayItems.filter(a => a.status === 'em_andamento').length;

  const rangeLabel = first.getMonth() === last.getMonth()
    ? `${first.getDate()} – ${last.getDate()} ${MONTHS_SHORT[first.getMonth()]}, ${last.getFullYear()}`
    : `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}, ${last.getFullYear()}`;

  return (
    <div className="agm-view">
      <section className="agm-nav agm-nav--left" aria-label="Navegação por semana">
        <span className="agm-nav__badge" aria-hidden="true">{Icons.cal}</span>
        <div className="agm-nav__center">
          <h2 className="agm-nav__title" style={{ fontSize: 15 }}>{rangeLabel}</h2>
          <p className="agm-nav__sub">{weekTotal} agendamento{weekTotal !== 1 ? 's' : ''}</p>
        </div>
        <div className="agm-nav__tools">
          <button type="button" className="agm-pill" onClick={() => onDateChange(new Date())}>Hoje</button>
          <button type="button" className="agm-iconbtn agm-iconbtn--sm" aria-label="Semana anterior" onClick={() => onDateChange(addDays(date, -7))}>
            {Icons.chevL}
          </button>
          <button type="button" className="agm-iconbtn agm-iconbtn--sm" aria-label="Próxima semana" onClick={() => onDateChange(addDays(date, 7))}>
            {AgendaIcons.chevR}
          </button>
        </div>
      </section>

      <div className="agm-ribbon" role="group" aria-label="Dias da semana">
        {weekDates.map(d => {
          const iso = toISODate(d);
          const n = byDay[iso]?.length ?? 0;
          const cls = [
            'agm-rday',
            n > 0 ? 'has-items' : '',
            iso === todayISO ? 'is-today' : '',
            iso === selectedISO ? 'is-selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={iso}
              type="button"
              className={cls}
              aria-pressed={iso === selectedISO}
              aria-label={`${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}, ${n} agendamento${n !== 1 ? 's' : ''}`}
              onClick={() => onDateChange(d)}
            >
              <span className="agm-rday__name">{WEEKDAYS_SHORT[d.getDay()]}</span>
              <span className="agm-rday__num">{d.getDate()}</span>
              <span className="agm-rday__count">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="agm-dayhead">
        <span className="agm-dayhead__dot" aria-hidden="true" />
        <div>
          <h3 className="agm-dayhead__title">{WEEKDAYS_LONG[date.getDay()]}, {date.getDate()} de {MONTHS[date.getMonth()]}</h3>
          <p className="agm-dayhead__sub">
            {dayItems.length} agendamento{dayItems.length !== 1 ? 's' : ''}
            {emAndamento > 0 && ` • ${emAndamento} em andamento`}
          </p>
        </div>
      </div>

      {dayItems.length === 0 ? (
        <div className="agm-empty">
          <p className="agm-empty__title">Nenhum agendamento neste dia</p>
          <p className="agm-empty__text">
            {hasFilters ? 'Os filtros ativos podem estar escondendo agendamentos.' : 'Escolha outro dia na fita ou crie um agendamento.'}
          </p>
          <button type="button" className="agm-btn" onClick={() => onNew(selectedISO)}>Agendar neste dia</button>
          {hasFilters && (
            <button type="button" className="agm-btn agm-btn--ghost" onClick={onClearFilters}>Limpar filtros</button>
          )}
        </div>
      ) : (
        <ul className="agm-list">
          {dayItems.map(ag => (
            <li key={ag.id}><MobileAppointmentCard agendamento={ag} onClick={() => onCardClick(ag)} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

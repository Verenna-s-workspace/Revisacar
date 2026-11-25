import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AgendaIcons } from '../icons';
import { MobileAppointmentCard } from './MobileAppointmentCard';
import { MOBILE_STATUS } from './statusTheme';
import { APPOINTMENT_STATUS_CONFIG } from '../StatusBadge';
import { useHorarioFuncionamento } from '../../../../hooks/useHorarioFuncionamento';
import {
  toISODate, addDays, timeToMinutes, MONTHS, WEEKDAYS_LONG,
} from '../../../../utils/agenda';
import type { Agendamento, AppointmentStatus } from '../../../../types/agendamento';

interface MobileDailyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (d: Date) => void;
  onCardClick: (ag: Agendamento) => void;
  onNew: (isoDate: string) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Cores/rótulos da legenda (derivados do tema mobile para não duplicar valores).
const STATUS_DOT = Object.fromEntries(
  (Object.keys(MOBILE_STATUS) as AppointmentStatus[]).map(s => [s, MOBILE_STATUS[s].stripe]),
) as Record<AppointmentStatus, string>;
const STATUS_LABEL = Object.fromEntries(
  (Object.keys(MOBILE_STATUS) as AppointmentStatus[]).map(s => [s, APPOINTMENT_STATUS_CONFIG[s].label]),
) as Record<AppointmentStatus, string>;


export function MobileDailyView({
  date, agendamentos, onDateChange, onCardClick, onNew, hasFilters, onClearFilters,
}: MobileDailyViewProps) {
  const { agendaHours } = useHorarioFuncionamento();
  const iso = toISODate(date);
  const isToday = iso === toISODate(new Date());

  // Minutos desde 00:00 — só atualiza (a cada minuto) quando o dia exibido é hoje.
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => {
    if (!isToday) return;
    const tick = () => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [isToday]);

  const dayItems = useMemo(
    () => agendamentos.filter(a => a.data === iso).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [agendamentos, iso],
  );

  // Horas do expediente + qualquer hora fora dele que tenha agendamento,
  // para nenhum card ficar escondido.
  const hours = useMemo(() => {
    const set = new Set<number>(agendaHours);
    dayItems.forEach(a => set.add(Math.floor(timeToMinutes(a.horaInicio) / 60)));
    return [...set].sort((x, y) => x - y);
  }, [agendaHours, dayItems]);

  const byHour = useMemo(() => {
    const map = new Map<number, Agendamento[]>();
    dayItems.forEach(a => {
      const h = Math.floor(timeToMinutes(a.horaInicio) / 60);
      map.set(h, [...(map.get(h) ?? []), a]);
    });
    return map;
  }, [dayItems]);

  const nowHour = Math.floor(nowMin / 60);
  const title = `${isToday ? 'Hoje, ' : ''}${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  const yearSuffix = date.getFullYear() !== new Date().getFullYear() ? ` de ${date.getFullYear()}` : '';
  const total = dayItems.length;

  const counts = (['pendente', 'agendado', 'em_andamento', 'aguardando_pagamento', 'pronto_retirada', 'concluido', 'cancelado', 'recusado'] as const)
    .map(st => ({ st, n: dayItems.filter(a => a.status === st).length }))
    .filter(x => x.n > 0);

  return (
    <div className="agm-view">
      <section className="agm-nav" aria-label="Navegação por dia">
        <button type="button" className="agm-iconbtn" aria-label="Dia anterior" onClick={() => onDateChange(addDays(date, -1))}>
          {AgendaIcons.chevsL}
        </button>
        <div className="agm-nav__center">
          <h2 className="agm-nav__title">{title}{yearSuffix}</h2>
          <p className="agm-nav__sub">
            {WEEKDAYS_LONG[date.getDay()]} · {total} agendamento{total !== 1 ? 's' : ''}
          </p>
          {!isToday && (
            <button type="button" className="agm-pill" style={{ marginTop: 6 }} onClick={() => onDateChange(new Date())}>
              Voltar para hoje
            </button>
          )}
        </div>
        <button type="button" className="agm-iconbtn" aria-label="Próximo dia" onClick={() => onDateChange(addDays(date, 1))}>
          {AgendaIcons.chevsR}
        </button>
      </section>

      {total === 0 ? (
        <div className="agm-empty">
          <p className="agm-empty__title">Nenhum agendamento neste dia</p>
          <p className="agm-empty__text">
            {hasFilters ? 'Os filtros ativos podem estar escondendo agendamentos.' : 'O dia está livre para novos agendamentos.'}
          </p>
          <button type="button" className="agm-btn" onClick={() => onNew(iso)}>Agendar neste dia</button>
          {hasFilters && (
            <button type="button" className="agm-btn agm-btn--ghost" onClick={onClearFilters}>Limpar filtros</button>
          )}
        </div>
      ) : (
        <>
          <ol className="agm-timeline" aria-label="Agendamentos do dia, em ordem de horário">
            {hours.map(h => {
              const cards = byHour.get(h) ?? [];
              const showNow = isToday && h === nowHour;
              // O marcador de "agora" entra antes do primeiro card que começa depois do horário atual.
              const idxNow = showNow ? cards.findIndex(a => timeToMinutes(a.horaInicio) > nowMin) : -1;
              const nowAt = showNow ? (idxNow === -1 ? cards.length : idxNow) : -1;

              return (
                <li key={h} className="agm-hour">
                  <span className="agm-hour__label">{pad2(h)}:00</span>
                  <div className="agm-hour__body">
                    {cards.length === 0 && <span className="agm-hour__empty">Disponível</span>}
                    {cards.map((ag, i) => (
                      <div key={ag.id} style={{ display: 'contents' }}>
                        {nowAt === i && <div className="agm-now" role="separator" aria-label="Horário atual" />}
                        <MobileAppointmentCard agendamento={ag} tinted onClick={() => onCardClick(ag)} />
                      </div>
                    ))}
                    {showNow && nowAt === cards.length && <div className="agm-now" role="separator" aria-label="Horário atual" />}
                  </div>
                </li>
              );
            })}
          </ol>

          {counts.length > 0 && (
            <div className="agm-legend">
              {counts.map(({ st, n }) => (
                <span key={st} className="agm-legend__item" style={{ '--dot': STATUS_DOT[st] } as CSSProperties}>
                  {STATUS_LABEL[st]} <strong>({n})</strong>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

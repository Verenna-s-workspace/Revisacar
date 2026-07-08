import { useMemo } from 'react';
import { tokens } from '../../../constants';
import { APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import { AgendaIcons } from './icons';
import {
  AGENDA_HOURS,
  DAY_START_HOUR,
  getWeekDates,
  toISODate,
  addDays,
  WEEKDAYS_SHORT,
  MONTHS_SHORT,
} from '../../../utils/agenda';
import type { Agendamento } from '../../../types/agendamento';

const HOUR_H = 68; // altura px por hora

interface WeeklyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (date: Date) => void;
  onCardClick: (ag: Agendamento) => void;
  onDayClick?: (date: Date) => void;
}

export function WeeklyView({ date, agendamentos, onDateChange, onCardClick, onDayClick }: WeeklyViewProps) {
  const todayISO = toISODate(new Date());
  const weekDates = getWeekDates(date);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const weekLabel = useMemo(() => {
    const s = weekDates[0];
    const e = weekDates[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} de ${MONTHS_SHORT[s.getMonth()]} de ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  }, [weekDates]);

  const byDay = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    weekDates.forEach(d => { map[toISODate(d)] = []; });
    agendamentos.forEach(ag => {
      if (map[ag.data]) map[ag.data].push(ag);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
    return map;
  }, [agendamentos, weekDates]);

  const totalH = AGENDA_HOURS.length * HOUR_H;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const nowTop = ((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_H;

  const timeToTop = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return ((h * 60 + m - DAY_START_HOUR * 60) / 60) * HOUR_H;
  };

  const timeToHeight = (inicio: string, fim: string) => {
    const [sh, sm] = inicio.split(':').map(Number);
    const [eh, em] = fim.split(':').map(Number);
    const dur = eh * 60 + em - sh * 60 - sm;
    return Math.max(dur / 60, 0.75) * HOUR_H - 4;
  };

  return (
    // Container principal — mesmo padrão do DailyView: flex:1 + minHeight:0
    // para poder encolher até o espaço disponível; só a timeline abaixo rola.
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'white', borderRadius: 16, border: `1px solid ${tokens.color.border}`, boxShadow: tokens.shadow.xs, overflow: 'hidden' }}>
      {/* Week header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => onDateChange(addDays(weekStart, -7))}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
          >
            {AgendaIcons.chevR}
          </button>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: tokens.color.text }}>{weekLabel}</div>
          <button
            onClick={() => onDateChange(addDays(weekEnd, 1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
          >
            {AgendaIcons.chevsR}
          </button>
        </div>
        <button
          onClick={() => onDateChange(new Date())}
          style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${tokens.color.ferrari}`, background: tokens.color.ferrariMid, color: tokens.color.ferrari, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Hoje
        </button>
      </div>

      {/* Day header row */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0 }}>
        <div style={{ width: 56, flexShrink: 0 }} />
        {weekDates.map(d => {
          const iso = toISODate(d);
          const isT = iso === todayISO;
          return (
            <div
              key={iso}
              onClick={() => onDayClick?.(d)}
              style={{
                flex: 1, textAlign: 'center', padding: '10px 4px', cursor: onDayClick ? 'pointer' : 'default',
                borderLeft: `1px solid ${tokens.color.border}`,
              }}
            >
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: isT ? tokens.color.ferrari : tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {WEEKDAYS_SHORT[d.getDay()]}
              </div>
              <div style={{
                fontSize: '1.05rem', fontWeight: 800,
                color: isT ? 'white' : tokens.color.text,
                width: 30, height: 30, borderRadius: '50%',
                background: isT ? tokens.color.ferrari : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '4px auto 0',
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Seção interna rolável: horários + agendamentos da semana */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', overscrollBehavior: 'contain' }}>
        <div style={{ display: 'flex', minHeight: totalH }}>
          {/* Hour labels */}
          <div style={{ width: 56, flexShrink: 0, borderRight: `1px solid ${tokens.color.border}`, position: 'relative' }}>
            {AGENDA_HOURS.map(h => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: (h - DAY_START_HOUR) * HOUR_H - 9,
                  width: '100%',
                  textAlign: 'right',
                  paddingRight: 10,
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  color: tokens.color.subtle,
                  fontFamily: tokens.fontMono,
                  userSelect: 'none',
                }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map(d => {
            const iso = toISODate(d);
            const isT = iso === todayISO;
            const items = byDay[iso] ?? [];

            return (
              <div
                key={iso}
                style={{ flex: 1, position: 'relative', borderLeft: `1px solid ${tokens.color.border}`, background: isT ? 'rgba(204,20,0,0.012)' : 'transparent' }}
              >
                {/* Hour lines */}
                {AGENDA_HOURS.map(h => (
                  <div
                    key={h}
                    style={{
                      position: 'absolute', left: 0, right: 0,
                      top: (h - DAY_START_HOUR) * HOUR_H,
                      height: 1, background: tokens.color.border, opacity: 0.6,
                    }}
                  />
                ))}

                {/* Now indicator (today only) */}
                {isT && nowTop >= 0 && nowTop < totalH && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 2, background: tokens.color.ferrari, zIndex: 5, pointerEvents: 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.color.ferrari, position: 'absolute', left: -4, top: -3 }} />
                  </div>
                )}

                {/* Cards */}
                {items.map(ag => {
                  const top = timeToTop(ag.horaInicio);
                  const height = timeToHeight(ag.horaInicio, ag.horaFim);
                  const cfg = APPOINTMENT_STATUS_CONFIG[ag.status];
                  if (top < 0) return null;

                  return (
                    <div
                      key={ag.id}
                      onClick={() => onCardClick(ag)}
                      style={{
                        position: 'absolute',
                        left: 3, right: 3,
                        top: top + 2,
                        height: height,
                        borderRadius: 8,
                        background: cfg.bg,
                        borderLeft: `3px solid ${cfg.color}`,
                        border: `1px solid ${cfg.border}`,
                        borderLeftWidth: 3,
                        padding: '4px 7px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        transition: 'filter 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.96)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = ''; }}
                    >
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: cfg.color, fontFamily: tokens.fontMono }}>
                        {ag.horaInicio}
                      </div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ag.cliente}
                      </div>
                      {height > 44 && (
                        <div style={{ fontSize: '0.64rem', color: tokens.color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ag.veiculo}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend bar */}
      <div style={{ display: 'flex', gap: 14, padding: '10px 20px', borderTop: `1px solid ${tokens.color.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {(['agendado', 'em_andamento', 'pronto_retirada', 'concluido', 'cancelado'] as const).map(st => {
          const count = agendamentos.filter(a => {
            const d = new Date(a.data);
            return d >= weekStart && d <= weekEnd && a.status === st;
          }).length;
          if (!count) return null;
          const cfg = APPOINTMENT_STATUS_CONFIG[st];
          return (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', color: tokens.color.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              {cfg.label} <strong style={{ color: tokens.color.text }}>({count})</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
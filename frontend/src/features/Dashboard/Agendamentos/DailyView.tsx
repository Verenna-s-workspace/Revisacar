import { useMemo } from 'react';
import { tokens } from '../../../constants';
import { AppointmentCard } from './AppointmentCard';
import { APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import { AgendaIcons } from './icons';
import {
  AGENDA_HOURS,
  DAY_START_HOUR,
  toISODate,
  formatDayMonth,
  addDays,
  WEEKDAYS_LONG,
} from '../../../utils/agenda';
import type { Agendamento } from '../../../types/agendamento';

const HOUR_H = 76; // altura em px de cada bloco de 1h na timeline

interface DailyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (date: Date) => void;
  onCardClick: (ag: Agendamento) => void;
}

export function DailyView({ date, agendamentos, onDateChange, onCardClick }: DailyViewProps) {
  const todayISO = toISODate(new Date());
  const iso = toISODate(date);
  const isToday = iso === todayISO;

  const dayItems = useMemo(
    () => agendamentos.filter(a => a.data === iso).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [agendamentos, iso]
  );

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const nowTop = isToday
    ? Math.max(0, ((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_H)
    : -1;

  const timeToTop = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return ((h * 60 + m - DAY_START_HOUR * 60) / 60) * HOUR_H;
  };

  const timeToHeight = (inicio: string, fim: string) => {
    const [sh, sm] = inicio.split(':').map(Number);
    const [eh, em] = fim.split(':').map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(dur / 60, 0.75) * HOUR_H - 6;
  };

  const totalH = AGENDA_HOURS.length * HOUR_H;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'white', borderRadius: 16, border: `1px solid ${tokens.color.border}`, boxShadow: tokens.shadow.xs, overflow: 'hidden' }}>
      {/* Day header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => onDateChange(addDays(date, -1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
          >
            {AgendaIcons.chevsL}
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: tokens.color.text }}>
              {isToday ? 'Hoje' : formatDayMonth(date)}
              {', '}
              <span style={{ color: tokens.color.muted, fontWeight: 500 }}>{date.getDate()} de {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][date.getMonth()]}</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: tokens.color.muted, marginTop: 1 }}>
              {WEEKDAYS_LONG[date.getDay()]} · {dayItems.length} agendamento{dayItems.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={() => onDateChange(addDays(date, 1))}
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
          >
            {AgendaIcons.chevsR}
          </button>
        </div>
        {!isToday && (
          <button
            onClick={() => onDateChange(new Date())}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${tokens.color.ferrari}`, background: tokens.color.ferrariMid, color: tokens.color.ferrari, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Hoje
          </button>
        )}
      </div>

      {/* Timeline scroll area */}
      <div style={{ overflowY: 'auto', flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', minHeight: totalH }}>
          {/* Hour labels column */}
          <div style={{ width: 60, flexShrink: 0, position: 'relative', borderRight: `1px solid ${tokens.color.border}` }}>
            {AGENDA_HOURS.map(h => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top: (h - DAY_START_HOUR) * HOUR_H - 9,
                  width: '100%',
                  textAlign: 'right',
                  paddingRight: 12,
                  fontSize: '0.72rem',
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

          {/* Cards column */}
          <div style={{ flex: 1, position: 'relative', padding: '0 16px' }}>
            {/* Hour separator lines */}
            {AGENDA_HOURS.map(h => (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: (h - DAY_START_HOUR) * HOUR_H,
                  height: 1,
                  background: tokens.color.border,
                  opacity: 0.7,
                }}
              />
            ))}

            {/* Now indicator */}
            {nowTop >= 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, display: 'flex', alignItems: 'center', zIndex: 10, pointerEvents: 'none' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: tokens.color.ferrari, marginLeft: 0, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 2, background: tokens.color.ferrari }} />
              </div>
            )}

            {/* Empty day placeholder */}
            {dayItems.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: tokens.color.muted }}>
                <div style={{ fontSize: '2rem', opacity: 0.2 }}>📅</div>
                <div style={{ fontSize: '0.84rem' }}>Nenhum agendamento neste dia</div>
              </div>
            )}

            {/* Appointment cards */}
            {dayItems.map(ag => {
              const top = timeToTop(ag.horaInicio);
              const height = timeToHeight(ag.horaInicio, ag.horaFim);
              const cfg = APPOINTMENT_STATUS_CONFIG[ag.status];

              if (top < 0) return null;

              return (
                <div
                  key={ag.id}
                  style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    top: top + 3,
                    height: height,
                    borderRadius: 12,
                    background: 'white',
                    border: `1px solid ${tokens.color.border}`,
                    borderLeft: `4px solid ${cfg.color}`,
                    boxShadow: tokens.shadow.sm,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 4,
                    zIndex: 2,
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onClick={() => onCardClick(ag)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = tokens.shadow.md;
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = tokens.shadow.sm;
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: tokens.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ag.cliente}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {APPOINTMENT_STATUS_CONFIG[ag.status].label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: tokens.fontMono, fontSize: '0.72rem', fontWeight: 700,
                        background: cfg.bg, color: cfg.color, padding: '2px 7px', borderRadius: 6,
                      }}
                    >
                      {ag.veiculo}
                    </span>
                    <span
                      style={{
                        fontFamily: tokens.fontMono, fontSize: '0.7rem', fontWeight: 700,
                        background: tokens.color.surfaceHigh, color: tokens.color.textSecond,
                        padding: '2px 7px', borderRadius: 6, letterSpacing: '0.04em',
                      }}
                    >
                      {ag.placa}
                    </span>
                  </div>
                  {height > 55 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                      <span style={{ fontSize: '0.74rem', color: tokens.color.muted, fontFamily: tokens.fontMono }}>
                        🕐 {ag.horaInicio} - {ag.horaFim}
                      </span>
                      {ag.mecanico && (
                        <span style={{ fontSize: '0.74rem', color: tokens.color.muted }}>
                          👤 {ag.mecanico}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom summary bar */}
      {dayItems.length > 0 && (
        <div style={{ display: 'flex', gap: 12, padding: '10px 20px', borderTop: `1px solid ${tokens.color.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
          {(['agendado', 'em_andamento', 'pronto_retirada', 'concluido', 'cancelado'] as const).map(st => {
            const count = dayItems.filter(a => a.status === st).length;
            if (!count) return null;
            const cfg = APPOINTMENT_STATUS_CONFIG[st];
            return (
              <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: tokens.color.muted }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                {cfg.label} <strong style={{ color: tokens.color.text }}>({count})</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

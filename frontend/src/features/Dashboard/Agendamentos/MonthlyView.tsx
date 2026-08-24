import { useMemo } from 'react';
import { tokens } from '../../../constants';
import { APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import { AgendaIcons } from './icons';
import {
  getMonthMatrix,
  toISODate,
  addMonths,
  addYears,
  WEEKDAYS_SHORT,
  MONTHS,
} from '../../../utils/agenda';
import type { Agendamento } from '../../../types/agendamento';

interface MonthlyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
}

export function MonthlyView({ date, agendamentos, onDateChange, onDayClick }: MonthlyViewProps) {
  const todayISO = toISODate(new Date());
  const year = date.getFullYear();
  const month = date.getMonth();

  const matrix = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const countByDay = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    agendamentos.forEach(ag => {
      if (!map[ag.data]) map[ag.data] = [];
      map[ag.data].push(ag);
    });
    return map;
  }, [agendamentos]);

  return (
    // Container principal — minHeight:0 para não forçar o `body` da página a
    // ultrapassar o espaço disponível quando o viewport for baixo.
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'white', borderRadius: 16, border: `1px solid ${tokens.color.border}`, boxShadow: tokens.shadow.xs, overflow: 'hidden' }}>
      {/* Month/Year header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Year navigation */}
          <button
            onClick={() => onDateChange(addYears(date, -1))}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
            title="Ano anterior"
          >
            {AgendaIcons.chevsL}
          </button>
          {/* Month navigation */}
          <button
            onClick={() => onDateChange(addMonths(date, -1))}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
            title="Mês anterior"
          >
            {AgendaIcons.chevR}
          </button>

          <div style={{ minWidth: 180, textAlign: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: tokens.color.text }}>
              {MONTHS[month]}
            </span>
            <span style={{ fontWeight: 500, fontSize: '1.05rem', color: tokens.color.muted, marginLeft: 8 }}>
              {year}
            </span>
          </div>

          <button
            onClick={() => onDateChange(addMonths(date, 1))}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
            title="Próximo mês"
          >
            {AgendaIcons.chevsR}
          </button>
          <button
            onClick={() => onDateChange(addYears(date, 1))}
            style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
            title="Próximo ano"
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

      {/* Weekday labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0 }}>
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontSize: '0.68rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {matrix.map((week, wi) => (
          <div
            key={wi}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7,1fr)',
              flex: 1,
              borderBottom: wi < matrix.length - 1 ? `1px solid ${tokens.color.border}` : undefined,
              minHeight: 80,
            }}
          >
            {week.map((day, di) => {
              const iso = toISODate(day);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = iso === todayISO;
              const items = countByDay[iso] ?? [];
              const active = items.filter(a => a.status !== 'cancelado');
              const cancelled = items.filter(a => a.status === 'cancelado');

              // Compute dominant status colour
              const hasInProgress = items.some(a => a.status === 'em_andamento');
              const hasReady = items.some(a => a.status === 'pronto_retirada');
              const hasScheduled = items.some(a => a.status === 'agendado');
              const accentColor = hasInProgress
                ? APPOINTMENT_STATUS_CONFIG.em_andamento.color
                : hasReady
                  ? APPOINTMENT_STATUS_CONFIG.pronto_retirada.color
                  : hasScheduled
                    ? tokens.color.ferrari
                    : tokens.color.ok;

              return (
                <div
                  key={di}
                  onClick={() => isCurrentMonth && onDayClick(day)}
                  style={{
                    borderRight: di < 6 ? `1px solid ${tokens.color.border}` : undefined,
                    padding: '8px 8px 6px',
                    background: isToday ? 'rgba(204,20,0,0.03)' : !isCurrentMonth ? tokens.color.bg : 'transparent',
                    cursor: isCurrentMonth ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    position: 'relative',
                    transition: 'background 0.1s',
                    minHeight: 80,
                  }}
                  onMouseEnter={e => { if (isCurrentMonth) (e.currentTarget as HTMLDivElement).style.background = tokens.color.surfaceHigh; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isToday ? 'rgba(204,20,0,0.03)' : !isCurrentMonth ? tokens.color.bg : 'transparent'; }}
                >
                  {/* Day number */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: isToday ? 800 : isCurrentMonth ? 600 : 400,
                        color: isToday ? 'white' : isCurrentMonth ? tokens.color.text : tokens.color.ghost,
                        width: 26, height: 26,
                        borderRadius: '50%',
                        background: isToday ? tokens.color.ferrari : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Appointment count pill */}
                  {isCurrentMonth && active.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px', borderRadius: 99,
                          background: isToday ? tokens.color.ferrari : `${accentColor}18`,
                          color: isToday ? 'white' : accentColor,
                          fontSize: '0.68rem', fontWeight: 700, alignSelf: 'flex-start',
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: isToday ? 'rgba(255,255,255,0.7)' : accentColor, flexShrink: 0 }} />
                        {isToday
                          ? `Hoje: ${active.length} slot${active.length > 1 ? 's' : ''}`
                          : `${active.length} agendamento${active.length > 1 ? 's' : ''}`}
                      </div>
                      {cancelled.length > 0 && (
                        <div style={{ fontSize: '0.62rem', color: tokens.color.muted, paddingLeft: 2 }}>
                          {cancelled.length} cancelado{cancelled.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
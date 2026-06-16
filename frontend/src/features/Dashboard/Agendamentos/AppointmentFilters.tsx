import { useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import { APPOINTMENT_STATUS_ORDER, APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import type { AppointmentStatus, AgendaFiltros, AgendaPeriodo } from '../../../types/agendamento';
import { useResponsive } from '../../../components/ui';

const PERIOD_OPTS: { val: AgendaPeriodo; label: string }[] = [
  { val: 'todos', label: 'Todos' },
  { val: 'hoje',  label: 'Hoje' },
  { val: 'semana',label: 'Esta semana' },
  { val: 'mes',   label: 'Este mês' },
];

const STATUS_OPTS: { val: AppointmentStatus | 'todos'; label: string }[] = [
  { val: 'todos', label: 'Todos os status' },
  ...APPOINTMENT_STATUS_ORDER.map(s => ({
    val: s as AppointmentStatus | 'todos',
    label: APPOINTMENT_STATUS_CONFIG[s].label,
  })),
];

interface AppointmentFiltersProps {
  search: string;
  filtros: AgendaFiltros;
  onSearch: (v: string) => void;
  onFiltros: (f: AgendaFiltros) => void;
}

export function AppointmentFilters({ search, filtros, onSearch, onFiltros }: AppointmentFiltersProps) {
  const { isMobile } = useResponsive();
  const [expanded, setExpanded] = useState(false);

  const hasActive = filtros.status !== 'todos' || filtros.periodo !== 'todos';

  const setStatus = (status: AppointmentStatus | 'todos') =>
    onFiltros({ ...filtros, status });

  const setPeriodo = (periodo: AgendaPeriodo) =>
    onFiltros({ ...filtros, periodo });

  const reset = () => {
    onFiltros({ status: 'todos', periodo: 'todos' });
    onSearch('');
  };

  const pill = (active: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 99,
        border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
        background: active ? tokens.color.ferrariMid : 'transparent',
        color: active ? tokens.color.ferrari : tokens.color.muted,
        fontSize: '0.78rem', fontWeight: active ? 700 : 400,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
        fontFamily: tokens.fontSans,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        background: 'white', borderBottom: `1px solid ${tokens.color.border}`,
        padding: isMobile ? '10px 14px' : '12px 28px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1,
            background: tokens.color.bg, borderRadius: 9,
            border: `1px solid ${tokens.color.border}`, padding: '7px 12px',
          }}
        >
          <span style={{ color: tokens.color.muted, display: 'flex', flexShrink: 0 }}>{Icons.search}</span>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Buscar por cliente ou placa..."
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: '0.83rem', color: tokens.color.text, width: '100%',
              fontFamily: tokens.fontSans,
            }}
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 2, fontSize: '1.1rem', lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 13px', borderRadius: 9,
            border: `1.5px solid ${hasActive ? tokens.color.ferrari : tokens.color.border}`,
            background: hasActive ? tokens.color.ferrariMid : 'transparent',
            color: hasActive ? tokens.color.ferrari : tokens.color.muted,
            fontSize: '0.8rem', fontWeight: hasActive ? 700 : 400,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: tokens.fontSans,
          }}
        >
          <span style={{ display: 'flex' }}>{AgendaIcons.filter}</span>
          Filtros
          {hasActive && <span style={{ fontSize: '0.65rem', opacity: 0.8, marginLeft: 2 }}>●</span>}
        </button>

        {hasActive && (
          <button
            onClick={reset}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: tokens.color.crit, fontSize: '0.78rem', fontWeight: 600,
              whiteSpace: 'nowrap', flexShrink: 0, fontFamily: tokens.fontSans, padding: '7px 4px',
            }}
          >
            Limpar
          </button>
        )}
      </div>

      {(expanded || !isMobile) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {PERIOD_OPTS.map(o => pill(filtros.periodo === o.val, () => setPeriodo(o.val), o.label))}
          </div>
          <div style={{ width: 1, height: 20, background: tokens.color.border, flexShrink: 0, alignSelf: 'center' }} />
          <select
            value={filtros.status}
            onChange={e => setStatus(e.target.value as AppointmentStatus | 'todos')}
            style={{
              padding: '5px 10px', borderRadius: 8, border: `1px solid ${tokens.color.border}`,
              background: 'white', color: tokens.color.text,
              fontSize: '0.78rem', fontFamily: tokens.fontSans, outline: 'none', cursor: 'pointer',
            }}
          >
            {STATUS_OPTS.map(o => (
              <option key={o.val} value={o.val}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

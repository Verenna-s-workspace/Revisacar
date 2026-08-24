import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { StatusBadge, APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import { AgendaIcons } from './icons';
import type { Agendamento } from '../../../types/agendamento';
import { formatTimeRange } from '../../../utils/agenda';

interface AppointmentCardProps {
  agendamento: Agendamento;
  /** `large` é usado na view Diária (estilo Intelly), `compact` na view Semanal. */
  variant?: 'large' | 'compact';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function AppointmentCard({ agendamento, variant = 'large', onClick, style }: AppointmentCardProps) {
  const cfg = APPOINTMENT_STATUS_CONFIG[agendamento.status];
  const isCompact = variant === 'compact';
  const wasRescheduled = !!agendamento.reagendamento;

  if (isCompact) {
    return (
      <div
        onClick={onClick}
        className="appointment-card"
        style={{
          background: 'white',
          borderRadius: 8,
          border: `1px solid ${tokens.color.border}`,
          borderLeft: `3px solid ${cfg.color}`,
          padding: '6px 8px',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ fontSize: '0.66rem', fontWeight: 800, color: cfg.color, whiteSpace: 'nowrap', fontFamily: tokens.fontMono }}>
            {agendamento.horaInicio}
          </span>
          {wasRescheduled && (
            <span style={{ display: 'flex', color: tokens.color.muted, flexShrink: 0 }} title="Reagendado">
              {AgendaIcons.sync}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: '0.74rem', fontWeight: 700, color: tokens.color.text, lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}
        >
          {agendamento.cliente}
        </div>
        <div style={{ fontSize: '0.66rem', color: tokens.color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agendamento.veiculo}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="appointment-card"
      style={{
        background: 'white',
        borderRadius: 14,
        border: `1px solid ${tokens.color.border}`,
        borderLeft: `4px solid ${cfg.color}`,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: tokens.shadow.xs,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: cfg.bg, color: cfg.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {Icons.car}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agendamento.cliente}
              </span>
              {wasRescheduled && (
                <span style={{ display: 'flex', color: tokens.color.subtle, flexShrink: 0 }} title="Agendamento remarcado">
                  {AgendaIcons.sync}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: '0.78rem', color: tokens.color.muted, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agendamento.veiculo}</span>
              <span style={{ flexShrink: 0, opacity: 0.6 }}>•</span>
              <span
                style={{
                  fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.color.textSecond,
                  flexShrink: 0, fontSize: '0.72rem', background: tokens.color.surfaceHigh,
                  padding: '1px 6px', borderRadius: 5, letterSpacing: '0.03em',
                }}
              >
                {agendamento.placa}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge status={agendamento.status} size="sm" />
      </div>

      {agendamento.titulo && (
        <div style={{ fontSize: '0.8rem', color: tokens.color.textSecond, paddingLeft: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agendamento.titulo}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 52, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: tokens.color.muted, fontFamily: tokens.fontMono }}>
          <span style={{ display: 'flex' }}>{Icons.clock}</span>
          {formatTimeRange(agendamento.horaInicio, agendamento.horaFim)}
        </div>
        {agendamento.mecanico && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: tokens.color.muted }}>
            <span style={{ display: 'flex' }}>{Icons.user}</span>
            {agendamento.mecanico}
          </div>
        )}
      </div>
    </div>
  );
}

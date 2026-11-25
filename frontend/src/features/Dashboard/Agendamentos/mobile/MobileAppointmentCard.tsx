import { Icons } from '../../Icons';
import { AgendaIcons } from '../icons';
import { APPOINTMENT_STATUS_CONFIG } from '../StatusBadge';
import { statusVars } from './statusTheme';
import { parseISODate, MONTHS_SHORT } from '../../../../utils/agenda';
import type { Agendamento } from '../../../../types/agendamento';

interface MobileAppointmentCardProps {
  agendamento: Agendamento;
  onClick: () => void;
  /** Mostra a data antes do horário (usado nos resultados de busca). */
  showDate?: boolean;
  /** Fundo levemente tingido pela cor do status (usado na linha do tempo). */
  tinted?: boolean;
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MobileAppointmentCard({ agendamento: ag, onClick, showDate, tinted }: MobileAppointmentCardProps) {
  const label = APPOINTMENT_STATUS_CONFIG[ag.status].label;
  const d = parseISODate(ag.data);
  const dateLabel = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  const range = `${ag.horaInicio} – ${ag.horaFim}`;

  return (
    <button
      type="button"
      className={`agm-card${tinted ? ' agm-card--tint' : ''}`}
      style={statusVars(ag.status)}
      onClick={onClick}
      aria-label={`${ag.cliente}, ${ag.veiculo}, placa ${ag.placa}, ${showDate ? dateLabel + ', ' : ''}${range}, ${label}`}
    >
      <span className="agm-card__top">
        <span className="agm-time">
          {Icons.clock}
          <span>{showDate ? `${dateLabel} · ${range}` : range}</span>
        </span>
        <span className="agm-badge">{label}</span>
      </span>

      <span className="agm-card__client">
        {ag.cliente}
        {ag.reagendamento && <span title="Agendamento remarcado" style={{ display: 'flex' }}>{AgendaIcons.sync}</span>}
      </span>

      <span className="agm-card__vehicle">
        <span className="agm-vehicle">
          {Icons.car}
          <span>{ag.veiculo}</span>
        </span>
        <span className="agm-plate">{ag.placa}</span>
      </span>

      {ag.titulo && (
        <span className="agm-card__service">
          {Icons.wrench}
          <span>{ag.titulo}</span>
        </span>
      )}

      {ag.mecanico && (
        <span className="agm-card__foot">
          <span className="agm-avatar" aria-hidden="true">{initials(ag.mecanico)}</span>
          <span>Mecânico: <strong>{ag.mecanico}</strong></span>
        </span>
      )}
    </button>
  );
}

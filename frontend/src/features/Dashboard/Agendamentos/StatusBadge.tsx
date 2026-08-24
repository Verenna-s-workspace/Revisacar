import type { JSX } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import type { AppointmentStatus } from '../../../types/agendamento';

// ── Configuração de status ────────────────────────────────────────────────────
// Cores reaproveitadas do design system existente:
//  - agendado            → tokens.color.warn   (mesmo tom usado em "Atenção")
//  - em_andamento        → mesmo par usado em .status-badge--rascunho
//  - aguardando_pagamento→ mesmo par usado em .status-badge--aguardando
//  - pronto_retirada     → tokens.color.ok     (mesmo tom usado em "OK")
//  - concluido           → mesmo par usado em .status-badge--finalizada
//  - cancelado           → tokens.color.crit / ferrari

export interface AppointmentStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: JSX.Element;
}

export const APPOINTMENT_STATUS_CONFIG: Record<AppointmentStatus, AppointmentStatusConfig> = {
  agendado: {
    label: 'Agendado',
    color: tokens.color.warn,
    bg: tokens.color.warnBg,
    border: tokens.color.warnBorder,
    icon: Icons.cal,
  },
  em_andamento: {
    label: 'Em Andamento',
    color: '#E65100',
    bg: '#FFF3E0',
    border: 'rgba(230,81,0,0.2)',
    icon: AgendaIcons.sync,
  },
  aguardando_pagamento: {
    label: 'Aguardando Pagamento',
    color: '#1565C0',
    bg: '#E3F2FD',
    border: 'rgba(21,101,192,0.2)',
    icon: AgendaIcons.dollarCircle,
  },
  pronto_retirada: {
    label: 'Pronto p/ Retirada',
    color: tokens.color.ok,
    bg: tokens.color.okBg,
    border: tokens.color.okBorder,
    icon: AgendaIcons.packageCheck,
  },
  concluido: {
    label: 'Concluído',
    color: '#2E7D32',
    bg: '#E8F5E9',
    border: 'rgba(46,125,50,0.2)',
    icon: AgendaIcons.checkCircle,
  },
  cancelado: {
    label: 'Cancelado',
    color: tokens.color.crit,
    bg: tokens.color.critBg,
    border: tokens.color.critBorder,
    icon: AgendaIcons.xCircle,
  },
};

/** Ordem padrão usada em filtros, listas de seleção e cards de resumo. */
export const APPOINTMENT_STATUS_ORDER: AppointmentStatus[] = [
  'agendado',
  'em_andamento',
  'aguardando_pagamento',
  'pronto_retirada',
  'concluido',
  'cancelado',
];

// ── StatusBadge ────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: AppointmentStatus;
  size?: 'sm' | 'md';
  withIcon?: boolean;
  style?: React.CSSProperties;
}

export function StatusBadge({ status, size = 'md', withIcon = true, style }: StatusBadgeProps) {
  const cfg = APPOINTMENT_STATUS_CONFIG[status];
  const isSm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: isSm ? '2px 8px' : '4px 11px',
        borderRadius: 99,
        fontSize: isSm ? '0.64rem' : '0.72rem',
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        fontFamily: tokens.fontSans,
        ...style,
      }}
    >
      {withIcon && <span style={{ display: 'flex', flexShrink: 0 }}>{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}

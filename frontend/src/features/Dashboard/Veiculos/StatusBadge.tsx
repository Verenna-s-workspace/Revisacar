import type { JSX } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { VeiculoIcons } from './icons';
import type { VeiculoStatus } from '../../../types/veiculo';

export interface VeiculoStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: JSX.Element;
}

export const VEICULO_STATUS_CONFIG: Record<VeiculoStatus, VeiculoStatusConfig> = {
  disponivel: {
    label: 'Disponível',
    color: tokens.color.ok,
    bg: tokens.color.okBg,
    border: tokens.color.okBorder,
    icon: Icons.check,
  },
  na_oficina: {
    label: 'Na Oficina',
    color: tokens.color.warn,
    bg: tokens.color.warnBg,
    border: tokens.color.warnBorder,
    icon: Icons.wrench,
  },
  aguardando_aprovacao: {
    label: 'Aguardando Aprovação',
    color: '#1565C0',
    bg: '#E3F2FD',
    border: 'rgba(21,101,192,0.2)',
    icon: Icons.clock,
  },
  pronto_entrega: {
    label: 'Pronto p/ Entrega',
    color: '#2E7D32',
    bg: '#E8F5E9',
    border: 'rgba(46,125,50,0.2)',
    icon: VeiculoIcons.swap,
  },
};

/** Ordem padrão usada em filtros e cards de resumo. */
export const VEICULO_STATUS_ORDER: VeiculoStatus[] = [
  'na_oficina',
  'aguardando_aprovacao',
  'pronto_entrega',
  'disponivel',
];

interface StatusBadgeProps {
  status: VeiculoStatus;
  size?: 'sm' | 'md';
  withIcon?: boolean;
  style?: React.CSSProperties;
}

export function StatusBadge({ status, size = 'md', withIcon = true, style }: StatusBadgeProps) {
  const cfg = VEICULO_STATUS_CONFIG[status];
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
      {withIcon && <span style={{ display: 'flex', flexShrink: 0, transform: 'scale(0.85)' }}>{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}

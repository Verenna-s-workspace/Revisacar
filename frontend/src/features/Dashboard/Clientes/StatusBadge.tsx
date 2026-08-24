import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { ClienteIcons } from './icons';
import type { ClienteStatus } from '../../../types/cliente';

// ── Configuração de status ────────────────────────────────────────────────────
// Paleta reaproveitada do design system existente sempre que o significado
// coincide com um status já usado em Veículos/Agendamentos (em_atendimento ~
// na_oficina, pronto_retirada ~ pronto_entrega/pronto_retirada,
// aguardando_aprovacao ~ aguardando_aprovacao, pagamento_pendente ~
// aguardando_pagamento). "Agendado" ganha um tom próprio (violeta) por ser um
// estado que só existe no cruzamento Cliente × Agendamento futuro, e
// "Disponível" fica neutro para não competir visualmente com os estados que
// realmente pedem atenção.

export interface ClienteStatusConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: JSX.Element;
}

export const CLIENTE_STATUS_CONFIG: Record<ClienteStatus, ClienteStatusConfig> = {
  em_atendimento: {
    label: 'Em Atendimento',
    color: tokens.color.warn,
    bg: tokens.color.warnBg,
    border: tokens.color.warnBorder,
    icon: Icons.wrench,
  },
  pronto_retirada: {
    label: 'Pronto p/ Retirada',
    color: tokens.color.ok,
    bg: tokens.color.okBg,
    border: tokens.color.okBorder,
    icon: ClienteIcons.packageCheck,
  },
  aguardando_aprovacao: {
    label: 'Aguardando Aprovação',
    color: '#1565C0',
    bg: '#E3F2FD',
    border: 'rgba(21,101,192,0.2)',
    icon: Icons.clock,
  },
  pagamento_pendente: {
    label: 'Pagamento Pendente',
    color: tokens.color.crit,
    bg: tokens.color.critBg,
    border: tokens.color.critBorder,
    icon: Icons.money,
  },
  agendado: {
    label: 'Agendado',
    color: '#6A1B9A',
    bg: '#F3E5F5',
    border: 'rgba(106,27,154,0.2)',
    icon: Icons.cal,
  },
  disponivel: {
    label: 'Disponível',
    color: tokens.color.muted,
    bg: tokens.color.surfaceHigh,
    border: tokens.color.border,
    icon: ClienteIcons.checkCircle,
  },
};

/** Ordem padrão usada em filtros e cards de resumo (do mais urgente ao neutro). */
export const CLIENTE_STATUS_ORDER: ClienteStatus[] = [
  'em_atendimento',
  'pronto_retirada',
  'aguardando_aprovacao',
  'pagamento_pendente',
  'agendado',
  'disponivel',
];

interface StatusBadgeProps {
  status: ClienteStatus;
  size?: 'sm' | 'md';
  withIcon?: boolean;
  /** Sobrepõe o texto padrão — usado para "Agendado • 15/07 às 14h". */
  dynamicLabel?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export function StatusBadge({ status, size = 'md', withIcon = true, dynamicLabel, onClick, style }: StatusBadgeProps) {
  const cfg = CLIENTE_STATUS_CONFIG[status];
  const isSm = size === 'sm';

  const content = (
    <>
      {withIcon && <span style={{ display: 'flex', flexShrink: 0, transform: 'scale(0.85)' }}>{cfg.icon}</span>}
      {dynamicLabel ?? cfg.label}
    </>
  );

  const baseStyle: React.CSSProperties = {
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
  };

  // Quando clicável (badge "Agendado" no card), usa <button> de verdade por
  // acessibilidade (foco por teclado, leitor de tela) em vez de um <span>
  // com onClick.
  if (onClick) {
    return (
      <button onClick={onClick} style={{ ...baseStyle, border: `1px solid ${cfg.border}`, cursor: 'pointer' }}>
        {content}
      </button>
    );
  }

  return <span style={baseStyle}>{content}</span>;
}

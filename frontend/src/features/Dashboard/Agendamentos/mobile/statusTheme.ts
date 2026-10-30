import type { CSSProperties } from 'react';
import type { AppointmentStatus } from '../../../../types/agendamento';

// Paleta de status da agenda mobile (referência: Stitch "Atelier Garage
// Precision"). Escopada ao mobile — o desktop continua usando
// APPOINTMENT_STATUS_CONFIG.

export interface MobileStatusTheme {
  fg: string;      // texto/ícone
  bg: string;      // fundo do badge
  border: string;  // borda do badge
  stripe: string;  // faixa lateral do card
}

export const MOBILE_STATUS: Record<AppointmentStatus, MobileStatusTheme> = {
  pendente:             { fg: '#6D28D9', bg: '#EDE9FE', border: '#DDD6FE', stripe: '#8B5CF6' },
  agendado:             { fg: '#B45309', bg: '#FEF3C7', border: '#FDE68A', stripe: '#F59E0B' },
  em_andamento:         { fg: '#1E40AF', bg: '#DBEAFE', border: '#BFDBFE', stripe: '#2563EB' },
  aguardando_pagamento: { fg: '#0E7490', bg: '#CFFAFE', border: '#A5F3FC', stripe: '#06B6D4' },
  pronto_retirada:      { fg: '#0F766E', bg: '#CCFBF1', border: '#99F6E4', stripe: '#14B8A6' },
  concluido:            { fg: '#15803D', bg: '#DCFCE7', border: '#BBF7D0', stripe: '#22C55E' },
  cancelado:            { fg: '#B91C1C', bg: '#FEE2E2', border: '#FECACA', stripe: '#EF4444' },
  recusado:             { fg: '#B91C1C', bg: '#FEE2E2', border: '#FECACA', stripe: '#EF4444' },
};

/** Variáveis CSS (--st-*) consumidas por agendaMobile.css. */
export function statusVars(status: AppointmentStatus): CSSProperties {
  const t = MOBILE_STATUS[status];
  return {
    '--st-fg': t.fg,
    '--st-bg': t.bg,
    '--st-border': t.border,
    '--st-stripe': t.stripe,
  } as CSSProperties;
}

/** Prioridade para escolher a cor dominante de um dia no calendário mensal. */
export const DAY_STATUS_PRIORITY: AppointmentStatus[] = [
  'em_andamento',
  'aguardando_pagamento',
  'pronto_retirada',
  'agendado',
  'pendente',
  'concluido',
];

import type { ReactNode } from 'react';
import type { FonteAlertaId } from '../../../utils/alertas';

// Lucide (24px, traço 1,75), como no resto do redesign.
const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const pequeno = { ...base, width: 16, height: 16 };

export const IcAgendar: ReactNode = (
  <svg {...pequeno}><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></svg>
);
export const IcMais: ReactNode = (
  <svg {...pequeno}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);

const IcCarteira = (
  <svg {...base}>
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
);
const IcRelogio = (
  <svg {...base}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);
const IcPacote = (
  <svg {...base}>
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" />
  </svg>
);
const IcAlerta = (
  <svg {...base}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);
const IcCheck = (
  <svg {...base}><polyline points="20 6 9 17 4 12" /></svg>
);
const IcSino = (
  <svg {...base}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
);

export const IcCheckGrande: ReactNode = IcCheck;

/** Mesmos ícones da tela de Alertas, por tipo de alerta. */
export function iconeDaFonte(fonte: FonteAlertaId): ReactNode {
  switch (fonte) {
    case 'os_sem_pagamento': return IcCarteira;
    case 'orcamento_sem_resposta':
    case 'os_aprovada_parada': return IcRelogio;
    case 'estoque_baixo':
    case 'reserva_sem_estoque':
    case 'estoque_quarentena': return IcPacote;
    case 'orcamento_respondido': return IcCheck;
    case 'cliente_nao_avisado': return IcSino;
    case 'os_bloqueada':
    default: return IcAlerta;
  }
}

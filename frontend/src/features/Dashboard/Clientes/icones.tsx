import type { ReactNode } from 'react';

// Lucide (24px, traço 1,75), desenhados em 16px como em Veículos, Ordens e Estoque.
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IcBuscar: ReactNode = (
  <svg {...base}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const IcFiltros: ReactNode = (
  <svg {...base}>
    <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
  </svg>
);

export const IcMais: ReactNode = (
  <svg {...base}>
    <path d="M5 12h14M12 5v14" />
  </svg>
);

export const IcFechar: ReactNode = (
  <svg {...base} width={14} height={14}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IcSetaEsq: ReactNode = (
  <svg {...base}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const IcSetaDir: ReactNode = (
  <svg {...base}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const IcReticencias: ReactNode = (
  <svg {...base} width={18} height={18}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

export const IcOlho: ReactNode = (
  <svg {...base}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IcEditar: ReactNode = (
  <svg {...base}>
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

export const IcCalendario: ReactNode = (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export const IcLixeira: ReactNode = (
  <svg {...base}>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
  </svg>
);

export const IcAlerta: ReactNode = (
  <svg {...base}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const IcUsuario: ReactNode = (
  <svg {...base}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
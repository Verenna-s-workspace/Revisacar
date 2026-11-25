import type { ReactNode } from 'react';

// Lucide (24px, traço 1,75) em 14px, como nos cartões do Figma.
const base = {
  width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IcRelogio: ReactNode = (
  <svg {...base}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
);
export const IcPessoa: ReactNode = (
  <svg {...base}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
export const IcAlerta: ReactNode = (
  <svg {...base}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></svg>
);
export const IcPacote: ReactNode = (
  <svg {...base}>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15" />
  </svg>
);
export const IcCalendario: ReactNode = (
  <svg {...base} width={16} height={16}>
    <path d="M8 2v4M16 2v4M3 10h18" /><rect width="18" height="18" x="3" y="4" rx="2" />
  </svg>
);

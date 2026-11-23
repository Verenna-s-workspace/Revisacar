import type { ReactNode } from 'react';

// Lucide (24px, traço 1,75) em 16px — mesmo padrão de Estoque/icones.tsx.
// Os que já existem lá (buscar, filtros, mais, fechar, editar, lixeira, setas) são importados de lá.
const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IcExportar: ReactNode = (
  <svg {...base}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
);
export const IcCalendario: ReactNode = (
  <svg {...base}><path d="M8 2v4M16 2v4M3 10h18" /><rect width="18" height="18" x="3" y="4" rx="2" /></svg>
);
export const IcConfirmar: ReactNode = (
  <svg {...base}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IcReceber: ReactNode = (
  <svg {...base}><path d="M17 7 7 17M17 17H7V7" /></svg>
);
export const IcPagar: ReactNode = (
  <svg {...base}><path d="M7 17 17 7M7 7h10v10" /></svg>
);
export const IcVazio: ReactNode = (
  <svg {...base} width={24} height={24}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
);

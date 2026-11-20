import type { ReactNode } from 'react';

// Lucide (24px, traço 1,75), desenhados em 16px como no Figma.
const base = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const IcMais: ReactNode = (
  <svg {...base}><path d="M5 12h14M12 5v14" /></svg>
);
export const IcLixeira: ReactNode = (
  <svg {...base}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
);
export const IcCheck: ReactNode = (
  <svg {...base}><path d="M20 6 9 17l-5-5" /></svg>
);
export const IcAlerta: ReactNode = (
  <svg {...base}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);
export const IcInstalar: ReactNode = (
  <svg {...base}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></svg>
);

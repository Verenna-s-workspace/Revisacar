import type { ReactNode } from 'react';

/** Ícones no estilo Lucide (24px, traço 1,75) — redimensionados por `size`. */
function Ic({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IcCheck = ({ size }: { size?: number }) => <Ic size={size}><path d="M20 6 9 17l-5-5" /></Ic>;
export const IcAlerta = ({ size }: { size?: number }) => (
  <Ic size={size}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></Ic>
);
export const IcCriticoX = ({ size }: { size?: number }) => <Ic size={size}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></Ic>;
export const IcMenos = ({ size }: { size?: number }) => <Ic size={size}><path d="M5 12h14" /></Ic>;
export const IcLapis = ({ size }: { size?: number }) => (
  <Ic size={size}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></Ic>
);
export const IcMais = ({ size }: { size?: number }) => <Ic size={size}><path d="M5 12h14" /><path d="M12 5v14" /></Ic>;
export const IcX = ({ size }: { size?: number }) => <Ic size={size}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Ic>;
export const IcTroca = ({ size }: { size?: number }) => <Ic size={size}><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></Ic>;
export const IcCopiar = ({ size }: { size?: number }) => (
  <Ic size={size}><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></Ic>
);
export const IcRestaurar = ({ size }: { size?: number }) => <Ic size={size}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></Ic>;
export const IcSetaDireita = ({ size }: { size?: number }) => <Ic size={size}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Ic>;
export const IcPrancheta = ({ size = 28 }: { size?: number }) => (
  <Ic size={size}><rect width="8" height="4" x="8" y="2" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></Ic>
);

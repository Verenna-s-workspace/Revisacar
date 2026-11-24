// Ícones de interface usados apenas na tela de Veículos. Seguem o mesmo estilo
// de `features/Dashboard/Icons.tsx` (stroke currentColor, viewBox 24x24).
// As ilustrações dos carros por categoria ficam em `./ilustracoes`.

export const VeiculoIcons = {
  filter: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  grid: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  palette: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 1 1 0-20c5 0 9 3.5 9 8 0 2.5-2 4-4.5 4H14a1.8 1.8 0 0 0-1.2 3.1c.4.4.6.9.6 1.4 0 1.4-1.1 2.5-2.4 2.5z" />
      <circle cx="7" cy="11" r="1.2" fill="currentColor" stroke="none" /><circle cx="9.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="17.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  gauge: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 17a9 9 0 1 1 15 0" /><line x1="12" y1="13" x2="15.5" y2="9" /><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  fuel: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="15" y2="22" /><line x1="6" y1="22" x2="6" y2="4" /><path d="M6 4h7v8H6" />
      <path d="M13 9h2.5L19 12.5V18a1.5 1.5 0 0 1-3 0v-1a1 1 0 0 0-1-1h-1" /><rect x="15.5" y="6" width="2.5" height="3.5" rx="0.5" transform="rotate(0 16.75 7.75)" />
    </svg>
  ),
  gearbox: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="7" r="2.3" /><circle cx="18" cy="7" r="2.3" /><circle cx="12" cy="17" r="2.3" />
      <line x1="8.1" y1="7" x2="15.9" y2="7" /><line x1="7.4" y1="9" x2="10.7" y2="15" /><line x1="16.6" y1="9" x2="13.3" y2="15" />
    </svg>
  ),
  door: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="1.5" /><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" /><line x1="5" y1="2" x2="5" y2="22" />
    </svg>
  ),
  linkUser: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.3" /><path d="M3.5 20a5.6 5.6 0 0 1 11 0" /><path d="M16 8h5M18.5 5.5v5" />
    </svg>
  ),
  unlinkUser: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.3" /><path d="M3.5 20a5.6 5.6 0 0 1 11 0" /><line x1="15.5" y1="5.5" x2="20.5" y2="10.5" /><line x1="20.5" y1="5.5" x2="15.5" y2="10.5" />
    </svg>
  ),
  swap: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  chevR: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  ),
  dots: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
  ),
  uploadCloud: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4.5 4.5 0 0 1-1-8.9 5.5 5.5 0 0 1 10.7-2A4.5 4.5 0 0 1 17 18H7z" />
      <polyline points="9.5 13.5 12 11 14.5 13.5" /><line x1="12" y1="11" x2="12" y2="18.5" />
    </svg>
  ),
  idCard: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2" />
      <line x1="13" y1="10" x2="18" y2="10" /><line x1="13" y1="14" x2="18" y2="14" />
    </svg>
  ),
  hash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="9" x2="19" y2="9" /><line x1="5" y1="15" x2="19" y2="15" />
      <line x1="10" y1="4" x2="8" y2="20" /><line x1="16" y1="4" x2="14" y2="20" />
    </svg>
  ),
  building: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1" /><line x1="9" y1="8" x2="9" y2="8.01" /><line x1="15" y1="8" x2="15" y2="8.01" />
      <line x1="9" y1="12" x2="9" y2="12.01" /><line x1="15" y1="12" x2="15" y2="12.01" /><path d="M9 21v-4h6v4" />
    </svg>
  ),
  noPhoto: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h3l1.5-2h9L18 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" /><line x1="3" y1="20" x2="21" y2="5" />
    </svg>
  ),
} as const;

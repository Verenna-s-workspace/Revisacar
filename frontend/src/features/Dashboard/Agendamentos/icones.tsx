import type { ReactNode } from 'react';

// Lucide (24px, traço 1,75) desenhados em 16px — mesmo conjunto de Ordens, Estoque e Veículos.
// Os que já existem lá são reexportados daqui, para a Agenda importar de um lugar só.
export {
  IcBuscar,
  IcFiltros,
  IcMais,
  IcFechar,
  IcSetaEsq,
  IcSetaDir,
  IcCarro,
  IcAlerta,
  IcUsuario,
} from '../Veiculos/icones';

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

export const IcCalendario: ReactNode = (
  <svg {...base}>
    <path d="M8 2v4M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
);

export const IcRelogio: ReactNode = (
  <svg {...base}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

/** Lucide calendar-plus — ação "Novo agendamento" do cabeçalho mobile (o CSS da tela amplia para 22px). */
export const IcCalendarioPlus: ReactNode = (
  <svg {...base}>
    <path d="M8 2v4M16 2v4" />
    <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
    <path d="M3 10h18" />
    <path d="M16 19h6M19 16v6" />
  </svg>
);

import type { ReactNode } from 'react';

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
    <path d='M8 2v4M16 2v4M3 10h18' />
    <rect width='18' height='18' x='3' y='4' rx='2' />
  </svg>
);

export const IcChave: ReactNode = (
  <svg {...base}>
    <path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z' />
  </svg>
);

export const IcCaixa: ReactNode = (
  <svg {...base}>
    <path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
    <path d='M3.3 7 12 12l8.7-5M12 22V12' />
  </svg>
);

/** SVG de caixas (moldura do Estoque) usado como fallback padrão nos cards de destaque quando não há foto. */
export function IcCaixas({ tamanho = 24 }: { tamanho?: number }) {
  return (
    <svg {...base} width={tamanho} height={tamanho}>
      <path d='M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z' />
      <path d='m7 16.5-4.74-2.85' />
      <path d='m7 16.5 5-3' />
      <path d='M7 16.5v5.17' />
      <path d='M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z' />
      <path d='m17 16.5-5-3' />
      <path d='m17 16.5 4.74-2.85' />
      <path d='M17 16.5v5.17' />
      <path d='M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z' />
      <path d='M12 8 7.26 5.15' />
      <path d='m12 8 4.74-2.85' />
      <path d='M12 13.5V8' />
    </svg>
  );
}

export const IcVazio: ReactNode = (
  <svg {...base} width={24} height={24}>
    <path d='M22 12h-6l-2 3h-4l-2-3H2' />
    <path d='M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' />
  </svg>
);
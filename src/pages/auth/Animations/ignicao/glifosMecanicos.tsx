import type { ReactNode } from 'react';

/**
 * Símbolos de mecânica usados no embaralhar da decodificação do nome.
 * Mesma linguagem visual dos ícones do site: viewBox 24, só traço (sem preenchimento), pontas
 * arredondadas. Chave inglesa, freio e câmbio vêm dos ícones que o sistema já usa; engrenagem,
 * bobina, mola, porca, vela, velocímetro, óleo, relâmpago e bateria seguem o mesmo traço.
 */

interface Glifo {
  nome: string;
  /** Conteúdo SVG (path/circle/line) dentro de um viewBox 24x24. */
  corpo: ReactNode;
}

export const GLIFOS: Glifo[] = [
  {
    nome: 'chave-inglesa', // ícone `wrench` do site
    corpo: (
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    ),
  },
  {
    nome: 'engrenagem',
    corpo: (
      <>
        <path d="M9.84 5.03 L10.27 1.95 L13.73 1.95 L14.16 5.03 L15.41 5.54 L17.89 3.67 L20.33 6.11 L18.46 8.59 L18.97 9.84 L22.05 10.27 L22.05 13.73 L18.97 14.16 L18.46 15.41 L20.33 17.89 L17.89 20.33 L15.41 18.46 L14.16 18.97 L13.73 22.05 L10.27 22.05 L9.84 18.97 L8.59 18.46 L6.11 20.33 L3.67 17.89 L5.54 15.41 L5.03 14.16 L1.95 13.73 L1.95 10.27 L5.03 9.84 L5.54 8.59 L3.67 6.11 L6.11 3.67 L8.59 5.54Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    nome: 'bobina', // bobina de ignição: corpo com enrolamentos e terminais
    corpo: (
      <>
        <rect x="5" y="5" width="14" height="15" rx="2" />
        <path d="M5 9.5h14M5 13h14M5 16.5h14M9 5V2.5M15 5V2.5" />
      </>
    ),
  },
  {
    nome: 'freio', // ícone `freios` do site
    corpo: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <line x1="3" y1="12" x2="9" y2="12" />
        <line x1="15" y1="12" x2="21" y2="12" />
      </>
    ),
  },
  {
    nome: 'mola', // mola helicoidal (suspensão)
    corpo: <path d="M12 2v3l-6 2.3 12 2.5-12 2.5 12 2.5-12 2.4 6 2.3v2.5" />,
  },
  {
    nome: 'porca',
    corpo: (
      <>
        <path d="M12 2.6l7.8 4.5v9.8L12 21.4l-7.8-4.5V7.1z" />
        <circle cx="12" cy="12" r="3.3" />
      </>
    ),
  },
  {
    nome: 'cambio', // ícone `gearbox` do site
    corpo: (
      <>
        <circle cx="6" cy="7" r="2.3" />
        <circle cx="18" cy="7" r="2.3" />
        <circle cx="12" cy="17" r="2.3" />
        <line x1="8.1" y1="7" x2="15.9" y2="7" />
        <line x1="7.4" y1="9" x2="10.7" y2="15" />
        <line x1="16.6" y1="9" x2="13.3" y2="15" />
      </>
    ),
  },
  {
    nome: 'vela', // vela de ignição
    corpo: (
      <>
        <path d="M10 2h4M12 2v3" />
        <path d="M9.5 5h5v6h-5z" />
        <path d="M8 11h8v3H8z" />
        <path d="M10 14v5M14 14v5M12 19v2.5M10 21.5h4" />
      </>
    ),
  },
  {
    nome: 'velocimetro', // ícone `gauge` do site
    corpo: (
      <>
        <path d="M4.5 17a9 9 0 1 1 15 0" />
        <line x1="12" y1="13" x2="15.5" y2="9" />
        <circle cx="12" cy="13" r="1.4" />
      </>
    ),
  },
  {
    nome: 'oleo',
    corpo: <path d="M12 2.7l5.66 5.64a8 8 0 1 1-11.31 0z" />,
  },
  {
    nome: 'eletrica', // `eletrica` do site (raio)
    corpo: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    nome: 'bateria',
    corpo: (
      <>
        <rect x="2" y="7" width="17" height="10" rx="2" />
        <path d="M22 11v2M6 12h4M8 10v4M14 12h3" />
      </>
    ),
  },
];

export const TOTAL_GLIFOS = GLIFOS.length;
export const idGlifo = (n: number): string => `ig-glifo-${n}`;

/** Sprite (<symbol>) escondido, usado pelos <use> de cada letra. Um só no overlay. */
export function SpriteGlifos() {
  return (
    <svg className="ig-sprite" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {GLIFOS.map((g, i) => (
          <symbol key={g.nome} id={idGlifo(i)} viewBox="0 0 24 24">
            {g.corpo}
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

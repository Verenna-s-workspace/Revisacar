import type { SlotFoto } from '../../../../../utils/fotos_obrigatorias';

/** Ícone de cada foto obrigatória (traço simples, herda a cor do texto). */
export function IconeSlot({ slot, size = 24 }: { slot: SlotFoto; size?: number }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };

  switch (slot) {
    case 'hodometro':     // velocímetro
      return (
        <svg {...props}>
          <path d="M4.5 17a8.5 8.5 0 1 1 15 0" />
          <path d="M12 16l3.6-4.6" />
          <circle cx="12" cy="16" r="1.2" />
          <path d="M6.2 11.2l1 .6M12 7.6v1.2M17.8 11.2l-1 .6" />
        </svg>
      );
    case 'frente':        // carro visto de frente (faróis)
      return (
        <svg {...props}>
          <path d="M5 15v-3l1.8-4.6A1.5 1.5 0 0 1 8.2 6.5h7.6a1.5 1.5 0 0 1 1.4.9L19 12v3" />
          <rect x="3" y="15" width="18" height="4" rx="1.2" />
          <circle cx="7" cy="17" r="0.9" />
          <circle cx="17" cy="17" r="0.9" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'traseira':      // carro visto de trás (lanternas e placa)
      return (
        <svg {...props}>
          <path d="M5 15v-3l1.8-4.6A1.5 1.5 0 0 1 8.2 6.5h7.6a1.5 1.5 0 0 1 1.4.9L19 12v3" />
          <rect x="3" y="15" width="18" height="4" rx="1.2" />
          <rect x="4.6" y="16.1" width="2.8" height="1.8" rx="0.4" />
          <rect x="16.6" y="16.1" width="2.8" height="1.8" rx="0.4" />
          <rect x="9.5" y="16.3" width="5" height="1.4" rx="0.3" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'lateral_direita':   // carro de lado + seta para a direita
      return (
        <svg {...props}>
          <path d="M3 17v-3l2.6-.8 2.2-3.4A1.5 1.5 0 0 1 9 9h6a1.5 1.5 0 0 1 1.2.6l2 2.6 2.8.8V17" />
          <path d="M3 17h18" />
          <circle cx="7.5" cy="17.2" r="1.7" />
          <circle cx="16.5" cy="17.2" r="1.7" />
          <path d="M8 5.5h8M13.5 3.5l2.5 2-2.5 2" />
        </svg>
      );
    case 'lateral_esquerda':  // carro de lado + seta para a esquerda
      return (
        <svg {...props}>
          <path d="M21 17v-3l-2.6-.8-2.2-3.4A1.5 1.5 0 0 0 15 9H9a1.5 1.5 0 0 0-1.2.6l-2 2.6L3 13v4" />
          <path d="M3 17h18" />
          <circle cx="7.5" cy="17.2" r="1.7" />
          <circle cx="16.5" cy="17.2" r="1.7" />
          <path d="M16 5.5H8M10.5 3.5l-2.5 2 2.5 2" />
        </svg>
      );
  }
}

export function IconeCamera({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function IconeCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

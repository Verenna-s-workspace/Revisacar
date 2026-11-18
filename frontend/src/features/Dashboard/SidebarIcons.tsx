import type { ReactNode } from 'react';
import type { NavPage } from '../../types/dashboard';

// Ícones da sidebar desktop: traço fino e arredondado (24×24, 1.7px), no estilo
// do layout de referência. São só da sidebar — o menu mobile continua usando
// os ícones de ./Icons. O tamanho é controlado pelo CSS (.rv-sb svg).

function Svg({ children }: { children?: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Ícone de cada tela (itens do menu + atalhos do grupo inferior). */
export const ICONES_PAGINA: Partial<Record<NavPage, JSX.Element>> = {
  // Visão Geral — 4 quadrados arredondados
  dashboard: (
    <Svg>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </Svg>
  ),
  // Ordens de Serviço — prancheta com lista
  ordens: (
    <Svg>
      <rect x="8" y="2.5" width="8" height="4" rx="1.2" />
      <path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
      <path d="M12 11.5h4M12 16.5h4M8 11.5h.01M8 16.5h.01" />
    </Svg>
  ),
  // Atendimento — balão de conversa
  atendimento: (
    <Svg>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2.5 21.5z" />
    </Svg>
  ),
  // Agendamentos — calendário
  agendamentos: (
    <Svg>
      <rect x="3.5" y="4.5" width="17" height="16.5" rx="2.5" />
      <path d="M16 2.5v4M8 2.5v4M3.5 10h17" />
    </Svg>
  ),
  // Clientes — pessoas
  clientes: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  // Veículos — carro
  veiculos: (
    <Svg>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </Svg>
  ),
  // Estoque — caixa
  estoque: (
    <Svg>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </Svg>
  ),
  // Catálogo de Serviços — chave inglesa
  servicos: (
    <Svg>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </Svg>
  ),
  // Relatórios — quadrado com barras
  relatorios: (
    <Svg>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 16.5v-4.5M12 16.5V8M16 16.5v-2.5" />
    </Svg>
  ),
  // Financeiro — moeda
  financeiro: (
    <Svg>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M15.5 8.5h-5a2 2 0 1 0 0 4h3a2 2 0 1 1 0 4H8.5M12 6.5v2M12 15.5v2" />
    </Svg>
  ),
  // Dicas — lâmpada
  dicas: (
    <Svg>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6M10 21.5h4" />
    </Svg>
  ),
  // Configurações — dois seletores (igual ao "Preferences" da referência)
  configuracoes: (
    <Svg>
      <rect x="2.5" y="4" width="19" height="7" rx="3.5" />
      <circle cx="17.5" cy="7.5" r="1.4" />
      <rect x="2.5" y="13" width="19" height="7" rx="3.5" />
      <circle cx="6.5" cy="16.5" r="1.4" />
    </Svg>
  ),
};

/** Ícones de apoio da sidebar. */
export const ICONES_SIDEBAR = {
  /** Botão de colapsar: painel com a coluna da esquerda. */
  painel: (
    <Svg>
      <rect x="3" y="3.5" width="18" height="17" rx="3" />
      <path d="M9.5 3.5v17" />
    </Svg>
  ),
  plus: (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  /** Setinhas pra cima e pra baixo, no canto do perfil. */
  seletor: (
    <Svg>
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </Svg>
  ),
  sair: (
    <Svg>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Svg>
  ),
};
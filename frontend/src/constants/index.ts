import type { Section, StatusConfig } from '../types';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Design Tokens ─────────────────────────────────────────────────────────────

export const tokens = {
  fontMono:    "'DM Mono', 'JetBrains Mono', monospace",
  fontSans:    "'DM Sans', sans-serif",
  fontDisplay: "'DM Sans', sans-serif",

  color: {
    // Brand red
    ferrari:     '#CC1400',
    ferrariDark: '#A01000',
    ferrariDeep: '#740C00',
    ferrariGlow: 'rgba(204,20,0,0.14)',
    ferrariMid:  'rgba(204,20,0,0.06)',

    // Backgrounds — warm light
    bg:          '#F7F6F3',
    bgAlt:       '#FAFAF8',
    surface:     '#FFFFFF',
    surfaceHigh: '#F3F1EC',
    card:        '#FFFFFF',

    // Borders
    border:      '#E5E2DA',
    borderMd:    '#D6D2C8',
    borderHigh:  '#C4C0B5',

    // Text
    text:        '#1A1A1A',
    textSecond:  '#3D3B37',
    muted:       '#6B6760',
    subtle:      '#9A958C',
    ghost:       '#C8C4BB',

    // Status
    ok:          '#1A7F4B',
    okBg:        'rgba(26,127,75,0.08)',
    okBorder:    'rgba(26,127,75,0.2)',
    warn:        '#B35C00',
    warnBg:      'rgba(179,92,0,0.08)',
    warnBorder:  'rgba(179,92,0,0.2)',
    crit:        '#CC1400',
    critBg:      'rgba(204,20,0,0.06)',
    critBorder:  'rgba(204,20,0,0.2)',
    na:          '#8A8580',
    naBg:        'rgba(138,133,128,0.08)',
    naBorder:    'rgba(138,133,128,0.2)',

    // Accent
    accent:      '#CC1400',
    accentHover: '#E01500',
    accentDim:   'rgba(204,20,0,0.1)',
  },

  radius: {
    sm:   '4px',
    md:   '7px',
    lg:   '10px',
    xl:   '16px',
    full: '9999px',
  },

  shadow: {
    xs:     '0 1px 2px rgba(0,0,0,0.06)',
    sm:     '0 1px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    md:     '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    lg:     '0 12px 32px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.05)',
    ferrari:'0 0 16px rgba(204,20,0,0.25)',
    inset:  'inset 0 1px 0 rgba(255,255,255,0.8)',
  },

  transition: {
    fast:   'all 0.13s cubic-bezier(0.4,0,0.2,1)',
    base:   'all 0.22s cubic-bezier(0.4,0,0.2,1)',
    spring: 'all 0.32s cubic-bezier(0.34,1.56,0.64,1)',
    smooth: 'all 0.36s cubic-bezier(0.25,0.46,0.45,0.94)',
  },
} as const;

// ── Sections ──────────────────────────────────────────────────────────────────

export const SECTIONS: Section[] = [
  {
    id: 'motor',
    label: 'Motor',
    icon: 'motor',
    items: [
      'Nível de óleo do motor',
      'Qualidade do óleo (cor/viscosidade)',
      'Filtro de ar',
      'Velas de ignição',
      'Bobinas de ignição',
      'Correia dentada / corrente',
      'Radiador',
      'Fluido de arrefecimento',
      'Mangueiras e abraçadeiras',
      'Tampa de válvulas (vazamentos)',
    ],
  },
  {
    id: 'freios',
    label: 'Freios',
    icon: 'freios',
    items: [
      'Pastilha dianteira (espessura mm)',
      'Disco dianteiro (desgaste/empenamento)',
      'Pastilha traseira (espessura mm)',
      'Disco traseiro (desgaste/empenamento)',
      'Fluido de freio (nível/cor)',
      'ABS / sensor de roda',
      'Freio de mão / freio de estacionamento',
    ],
  },
  {
    id: 'suspensao',
    label: 'Suspensão',
    icon: 'suspensao',
    items: [
      'Amortecedor dianteiro',
      'Amortecedor traseiro',
      'Bandeja dianteira',
      'Pivô / terminal de direção',
      'Barra estabilizadora / buchas',
      'Rolamento de roda (folga/ruído)',
      'Coxim do amortecedor',
    ],
  },
  {
    id: 'eletrica',
    label: 'Elétrica',
    icon: 'eletrica',
    items: [
      'Bateria (carga/tensão V)',
      'Alternador (tensão de carga V)',
      'Motor de arranque',
      'Fusíveis e relés',
      'Iluminação dianteira (farol/neblina)',
      'Iluminação traseira (stop/ré)',
      'Setas / pisca-alerta',
      'Limpadores de para-brisa',
    ],
  },
  {
    id: 'transmissao',
    label: 'Transmissão',
    icon: 'transmissao',
    items: [
      'Óleo de câmbio (nível/cor)',
      'Embreagem (desgaste/regulagem)',
      'Semi-eixo / homocinética',
      'Caixa de câmbio (ruído/folga)',
      'Diferencial',
    ],
  },
  {
    id: 'pneus',
    label: 'Pneus e Rodas',
    icon: 'pneus',
    items: [
      'Pneu dianteiro direito (sulco mm)',
      'Pneu dianteiro esquerdo (sulco mm)',
      'Pneu traseiro direito (sulco mm)',
      'Pneu traseiro esquerdo (sulco mm)',
      'Estepe (condição/calibragem)',
      'Calibragem geral',
      'Balanceamento / alinhamento',
    ],
  },
  {
    id: 'carroceria',
    label: 'Carroceria',
    icon: 'carroceria',
    items: [
      'Pintura geral (riscos/amassados)',
      'Para-choques dianteiro',
      'Para-choques traseiro',
      'Capô (fechamento/vedação)',
      'Portas (fechamento/dobradiças)',
      'Vidros e para-brisas',
      'Retrovisores (elétrico/manual)',
      'Teto solar (se aplicável)',
    ],
  },
  {
    id: 'interior',
    label: 'Interior',
    icon: 'interior',
    items: [
      'Painel e instrumentos',
      'Ar-condicionado (funcionamento)',
      'Sistema de áudio',
      'Cintos de segurança',
      'Airbags (luz de aviso)',
      'Tapetes e revestimentos',
      'Limpeza interna geral',
    ],
    
  },{
  id: 'adicionais',
  label: 'Inspeção Personalizada',
  icon: 'adicionais',
  items: [],
  isDynamic: true

  }
];

// ── Status Config ─────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  ok:   { label: 'OK',      color: tokens.color.ok,   bg: tokens.color.okBg,   border: tokens.color.okBorder,   dot: tokens.color.ok },
  warn: { label: 'Atenção', color: tokens.color.warn, bg: tokens.color.warnBg, border: tokens.color.warnBorder, dot: tokens.color.warn },
  crit: { label: 'Crítico', color: tokens.color.crit, bg: tokens.color.critBg, border: tokens.color.critBorder, dot: tokens.color.crit },
  na:   { label: 'N/A',     color: tokens.color.na,   bg: tokens.color.naBg,   border: tokens.color.naBorder,   dot: tokens.color.na },
};

// ── Options ───────────────────────────────────────────────────────────────────

export const COMBUSTIVEL_OPTIONS = ['Gasolina', 'Etanol', 'Flex', 'Diesel', 'Elétrico', 'Híbrido', 'GNV'];
export const NIVEL_COMBUSTIVEL_OPTIONS = ['Reserva', '1/4', '1/2', '3/4', 'Cheio'];
export const STEP_LABELS = ['Identificação', 'Serviços', 'Checklist', 'Fotos', 'Encerramento'];

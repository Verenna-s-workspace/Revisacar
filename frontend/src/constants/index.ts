import type { Section, StatusConfig } from '../types';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Design Tokens ─────────────────────────────────────────────────────────────

export const tokens = {
  fontMono:    "var(--font-mono)",
  fontSans:    "var(--font-sans)",
  fontDisplay: "var(--font-display)",
  fontLogo:    "'Fredoka', cursive",

  color: {
    // Brand red
    ferrari:     'var(--color-ferrari)',
    ferrariDark: 'var(--color-ferrari-dark)',
    ferrariDeep: 'var(--color-ferrari-deep)',
    ferrariGlow: 'var(--color-ferrari-glow)',
    ferrariMid:  'var(--color-ferrari-mid)',

    // Backgrounds — warm light
    bg:          'var(--color-bg)',
    bgAlt:       'var(--color-bg-alt)',
    surface:     'var(--color-surface)',
    surfaceHigh: 'var(--color-surface-high)',
    card:        'var(--color-card)',

    // Borders
    border:      'var(--color-border)',
    borderMd:    'var(--color-border-md)',
    borderHigh:  'var(--color-border-high)',

    // Text
    text:        'var(--color-text)',
    textSecond:  'var(--color-text-second)',
    muted:       'var(--color-muted)',
    subtle:      'var(--color-subtle)',
    ghost:       'var(--color-ghost)',

    // Status
    ok:          'var(--color-ok)',
    okBg:        'var(--color-ok-bg)',
    okBorder:    'var(--color-ok-border)',
    warn:        'var(--color-warn)',
    warnBg:      'var(--color-warn-bg)',
    warnBorder:  'var(--color-warn-border)',
    crit:        'var(--color-crit)',
    critBg:      'var(--color-crit-bg)',
    critBorder:  'var(--color-crit-border)',
    na:          'var(--color-na)',
    naBg:        'var(--color-na-bg)',
    naBorder:    'var(--color-na-border)',

    // Accent
    accent:      'var(--color-accent)',
    accentHover: 'var(--color-accent-hover)',
    accentDim:   'var(--color-accent-dim)',
  },

  radius: {
    sm:   'var(--radius-sm)',
    md:   'var(--radius-md)',
    lg:   'var(--radius-lg)',
    xl:   'var(--radius-xl)',
    full: 'var(--radius-full)',
  },

  shadow: {
    xs:     'var(--shadow-xs)',
    sm:     'var(--shadow-sm)',
    md:     'var(--shadow-md)',
    lg:     'var(--shadow-lg)',
    ferrari:'var(--shadow-ferrari)',
    inset:  'var(--shadow-inset)',
  },

  transition: {
    fast:   'var(--transition-fast)',
    base:   'var(--transition-base)',
    spring: 'var(--transition-spring)',
    smooth: 'var(--transition-smooth)',
  },
} as const;

// ── Sections ──────────────────────────────────────────────────────────────────

/* export const SECTIONS: Section[] = [
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
*/

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
export const STEP_LABELS = ['Identificação','Fotos', 'Encerramento'];

// Ícones e ilustrações usados apenas na tela de Veículos. Seguem o mesmo
// estilo de `features/Dashboard/Icons.tsx` (stroke currentColor, viewBox 24x24)
// para os ícones de interface, e um conjunto adicional de silhuetas por
// categoria de carroceria — usadas como foto padrão quando o veículo não tem
// nenhuma foto cadastrada.

import type { ReactNode, JSX } from 'react';
import { tokens } from '../../../constants';
import type { VeiculoCategoria } from '../../../types/veiculo';

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

// ── Silhuetas por categoria ────────────────────────────────────────────────────
// Ilustração de "foto padrão" exibida quando o veículo não possui nenhuma foto
// cadastrada. Desenhadas como vetor side-profile simplificado, com tom duotone
// derivado da paleta da marca (vermelho RevisaCar), para parecer um placeholder
// intencional e não uma imagem quebrada.

const BODY  = tokens.color.ferrari;
const EDGE  = tokens.color.ferrariDark;
const GLASS = tokens.color.surface;
const TIRE  = tokens.color.text;
const GROUND = tokens.color.border;

function Wheel({ cx, r = 16 }: { cx: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={100} r={r} fill={GLASS} stroke={TIRE} strokeWidth={5} />
      <circle cx={cx} cy={100} r={r * 0.37} fill={TIRE} />
    </>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="6" y1="100" x2="234" y2="100" stroke={GROUND} strokeWidth={2} />
      {children}
    </svg>
  );
}

export const VEHICLE_SILHOUETTES: Record<VeiculoCategoria, JSX.Element> = {
  sedan: (
    <Frame>
      <path d="M18,100 L18,88 Q20,82 28,82 L52,82 Q60,55 92,41 Q105,34 138,34 Q160,34 168,48 L172,68 L196,68 Q204,68 206,76 L208,82 L212,82 Q220,82 222,90 L222,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M59,80 Q66,58 93,45 Q104,39 134,39 Q152,39 159,50 L164,68 L100,68 L100,80 Z" fill={GLASS} opacity={0.92} />
      <line x1="100" y1="39" x2="100" y2="80" stroke={EDGE} strokeWidth={2} />
      <Wheel cx={63} /><Wheel cx={182} />
    </Frame>
  ),
  hatch: (
    <Frame>
      <path d="M20,100 L20,88 Q22,82 30,82 L50,82 Q58,52 90,40 Q102,34 122,34 Q138,34 146,44 Q151,50 151,62 L151,82 L196,82 Q206,82 208,90 L208,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M56,80 Q64,56 92,44 Q102,39 121,39 Q134,39 140,47 Q144,52 144,62 L144,80 Z" fill={GLASS} opacity={0.92} />
      <line x1="105" y1="39" x2="105" y2="80" stroke={EDGE} strokeWidth={2} />
      <Wheel cx={60} /><Wheel cx={164} />
    </Frame>
  ),
  suv: (
    <Frame>
      <path d="M14,100 L14,78 Q15,68 25,68 L38,68 Q40,40 60,32 Q68,28 84,28 L160,28 Q170,28 170,40 L170,68 L196,68 Q208,68 210,80 L210,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M44,66 Q46,46 62,38 Q68,34 84,34 L154,34 L154,66 Z" fill={GLASS} opacity={0.92} />
      <line x1="96" y1="34" x2="96" y2="66" stroke={EDGE} strokeWidth={2} />
      <line x1="128" y1="34" x2="128" y2="66" stroke={EDGE} strokeWidth={2} />
      <rect x="16" y="88" width="192" height="6" rx="3" fill={EDGE} opacity={0.35} />
      <Wheel cx={58} r={19} /><Wheel cx={176} r={19} />
    </Frame>
  ),
  picape: (
    <Frame>
      <path d="M16,100 L16,86 Q17,78 26,78 L40,78 Q47,52 74,40 Q86,34 108,34 Q122,34 128,44 L132,62 L132,78 L150,78 L150,64 Q150,58 156,58 L208,58 Q220,58 222,68 L222,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M44,76 Q51,56 76,44 Q86,39 106,39 Q116,39 120,47 L124,62 L52,62 Z" fill={GLASS} opacity={0.92} />
      <rect x="138" y="64" width="78" height="14" fill={GLASS} opacity={0.5} />
      <line x1="132" y1="78" x2="132" y2="62" stroke={EDGE} strokeWidth={2} />
      <Wheel cx={62} /><Wheel cx={182} />
    </Frame>
  ),
  van: (
    <Frame>
      <path d="M18,100 L18,50 Q18,40 30,38 Q44,36 60,36 L196,36 Q212,36 216,52 L222,80 L222,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M28,42 Q40,40 50,40 L58,40 L58,68 L24,68 Q24,52 28,42 Z" fill={GLASS} opacity={0.92} />
      <rect x="66" y="42" width="46" height="26" fill={GLASS} opacity={0.85} />
      <rect x="118" y="42" width="46" height="26" fill={GLASS} opacity={0.85} />
      <rect x="170" y="42" width="38" height="26" fill={GLASS} opacity={0.85} />
      <Wheel cx={58} /><Wheel cx={186} />
    </Frame>
  ),
  utilitario: (
    <Frame>
      <path d="M16,100 L16,70 Q16,58 28,52 Q40,46 52,46 L60,46 L60,40 Q60,34 68,34 L196,34 Q210,34 212,48 L218,80 L218,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M30,52 Q40,48 50,48 L57,48 L57,70 L27,70 Q26,60 30,52 Z" fill={GLASS} opacity={0.92} />
      <line x1="60" y1="40" x2="60" y2="98" stroke={EDGE} strokeWidth={2} opacity={0.55} />
      <line x1="196" y1="38" x2="196" y2="98" stroke={EDGE} strokeWidth={2} opacity={0.55} />
      <Wheel cx={56} /><Wheel cx={182} />
    </Frame>
  ),
  esportivo: (
    <Frame>
      <path d="M14,100 L14,92 Q15,86 24,86 L46,86 Q56,66 78,56 Q92,49 118,48 Q140,47 156,54 Q168,59 176,70 L184,86 L210,86 Q220,86 222,94 L222,100 Z" fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      <path d="M58,84 Q66,68 84,60 Q96,55 116,54 Q134,53 148,59 Q158,64 164,73 L170,84 Z" fill={GLASS} opacity={0.92} />
      <line x1="112" y1="53" x2="112" y2="84" stroke={EDGE} strokeWidth={2} />
      <rect x="170" y="44" width="34" height="6" rx="2" fill={EDGE} />
      <rect x="180" y="49" width="6" height="9" fill={EDGE} /><rect x="196" y="49" width="6" height="9" fill={EDGE} />
      <Wheel cx={58} /><Wheel cx={194} />
    </Frame>
  ),
};

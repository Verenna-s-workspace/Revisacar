import { useEffect, useSyncExternalStore, CSSProperties, ReactNode } from 'react';
import { tokens } from '../constants';

// ── useResponsive hook ────────────────────────────────────────────────────────

/** Breakpoints do app (px). Mantenha em sincronia com os @media dos .css:
 *  639/640 (celular), 979/980 (desktop). */
export const BREAKPOINTS = { sm: 480, md: 640, lg: 980 } as const;

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg';

function getBreakpoint(w: number): Breakpoint {
  if (w < BREAKPOINTS.sm) return 'xs';
  if (w < BREAKPOINTS.md) return 'sm';
  if (w < BREAKPOINTS.lg) return 'md';   // desktop layout kicks in at exactly 980 px
  return 'lg';
}

// Uma única assinatura de resize para o app inteiro. Antes cada componente que
// chamava useResponsive() registrava o próprio listener (dezenas ao mesmo tempo).
const listeners = new Set<() => void>();
let current: Breakpoint =
  typeof window !== 'undefined' ? getBreakpoint(window.innerWidth) : 'lg';

function update() {
  const next = getBreakpoint(window.innerWidth);
  if (next !== current) {
    current = next;
    listeners.forEach(l => l());
  }
}

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
  }
  listeners.add(cb);
  update();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    }
  };
}

export function useResponsive() {
  const bp = useSyncExternalStore(subscribe, () => current, () => 'lg' as Breakpoint);

  return {
    bp,
    isMobile:  bp === 'xs' || bp === 'sm',
    isTablet:  bp === 'md',
    isDesktop: bp === 'lg',
    /** Celular OU tablet/celular deitado (< 980px). É o que decide usar o
     *  layout mobile (topbar + bottom nav) em vez da sidebar de 240px, que
     *  espremia o conteúdo na faixa de 640–979px. */
    isCompact: bp !== 'lg',
  };
}


// ── Shared input styles ───────────────────────────────────────────────────────

export const inp: CSSProperties = {
  fontFamily: tokens.fontSans,
  fontSize: '0.9rem',
  color: tokens.color.text,
  background: tokens.color.bgAlt,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  padding: '9px 13px',
  outline: 'none',
  width: '100%',
  WebkitAppearance: 'none',
  transition: 'border-color 0.18s, box-shadow 0.18s',
  boxSizing: 'border-box',
};

export const inpError: CSSProperties = {
  ...inp,
  borderColor: tokens.color.crit,
  background: tokens.color.critBg,
};

export const inpStyle = (hasError: boolean): CSSProperties =>
  hasError ? inpError : inp;

// ── Responsive grid helpers ───────────────────────────────────────────────────

/**
 * Returns a responsive 3-column grid style.
 * lg → 3 cols | md → 2 cols | xs/sm → 1 col
 */
export function useGrid3(): CSSProperties {
  const { bp } = useResponsive();
  // lg (≥980px) → original 3 cols | md (640–979px) → 2 cols | mobile → 1 col
  const cols = bp === 'lg' ? 3 : bp === 'md' ? 2 : 1;
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '14px 18px',
  };
}

/**
 * Returns a responsive 4-column grid style.
 * lg → 4 cols | md → 2 cols | xs/sm → 1 col
 */
export function useGrid4(): CSSProperties {
  const { bp } = useResponsive();
  const cols = bp === 'lg' ? 4 : bp === 'md' ? 2 : 1;
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '14px 18px',
  };
}

/**
 * Static fallbacks (for use outside components that can't call hooks).
 * These still work but won't be reactive. Prefer useGrid3 / useGrid4 inside
 * React components.
 */

// min(100%, …) evita estourar a largura em telas de 320px (antes: minmax(300px, …)).
export const grid3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
  gap: '14px 18px',
};

// Antes: 'auto-fill, minmax(250px, 1fr))' — faltava `repeat(`, o navegador
// descartava a regra e o formulário virava uma coluna só.
export const grid4: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
  gap: '14px 18px',
};

// ── Button styles ─────────────────────────────────────────────────────────────

const baseBtn: CSSProperties = {
  fontFamily: tokens.fontSans,
  fontSize: '0.875rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  minHeight: 44,            // alvo de toque mínimo
  justifyContent: 'center',
  padding: '9px 20px',
  borderRadius: tokens.radius.md,
  border: 'none',
  cursor: 'pointer',
  transition: tokens.transition.base,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
export const btnSolid: CSSProperties    = { ...baseBtn, background: tokens.color.surfaceHigh, color: tokens.color.textSecond, border: `1px solid ${tokens.color.border}` };
export const btnAccent: CSSProperties   = { ...baseBtn, background: tokens.color.ferrari,    color: '#fff', boxShadow: '0 1px 4px rgba(204,20,0,0.3)' };
export const btnGhost: CSSProperties    = { ...baseBtn, background: 'transparent', color: tokens.color.muted, border: `1px solid ${tokens.color.border}` };
export const btnDisabled: CSSProperties = { ...baseBtn, background: tokens.color.surfaceHigh, color: tokens.color.subtle, cursor: 'not-allowed', border: `1px solid ${tokens.color.border}` };
export const pfNote: CSSProperties = {
  fontFamily: tokens.fontSans,
  fontSize: '0.75rem',
  color: tokens.color.subtle,
};
// ── SectionTitle ──────────────────────────────────────────────────────────────
interface SectionTitleProps { children: ReactNode; }
export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div style={{
      fontFamily: tokens.fontSans,
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: tokens.color.muted,
      marginBottom: 18,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{
        width: 16, height: 2,
        background: tokens.color.ferrari,
        borderRadius: 1,
        display: 'block',
        flexShrink: 0,
      }} />
      {children}
    </div>
  );
}
// ── FormBlock ─────────────────────────────────────────────────────────────────
interface FormBlockProps { title?: string; children: ReactNode; noBorder?: boolean; }

export function FormBlock({ title, children, noBorder }: FormBlockProps) {
  const { isMobile, isTablet } = useResponsive();
  // Preserve original 40px padding on desktop (≥980px)
  const px = isMobile ? 16 : isTablet ? 24 : 40;
  const py = isMobile ? 18 : 26;

  return (
    <div style={{
      background: tokens.color.surface,
      borderBottom: noBorder ? 'none' : `1px solid ${tokens.color.border}`,
      padding: `${py}px ${px}px`,
    }}>
      {title && <SectionTitle>{title}</SectionTitle>}
      {children}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  /**
   * `span` is respected only on desktop. On mobile every field takes full width.
   */
  span?: number;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, span, hint, children }: FieldProps) {
  const { isMobile, isTablet } = useResponsive();

  // Colapsa o span: 1 coluna no celular; no tablet (grade de 2 colunas) qualquer
  // span >= 2 ocupa a linha toda — antes `span 4` criava colunas implícitas.
  const gridColumn = isMobile || !span
    ? undefined
    : isTablet
      ? (span >= 2 ? '1 / -1' : undefined)
      : `span ${span}`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      gridColumn,
    }}>
      <label style={{
        fontFamily: tokens.fontSans,
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: tokens.color.textSecond,
      }}>
        {label}
      </label>
      {children}
     
      {hint && (
        <span style={{
          fontFamily: tokens.fontSans,
          fontSize: '0.75rem',
          color: tokens.color.subtle,
        }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ── PanelFooter ───────────────────────────────────────────────────────────────

interface PanelFooterProps { left?: ReactNode; right?: ReactNode; }

export function PanelFooter({ left, right }: PanelFooterProps) {
  const { isCompact } = useResponsive();

  // Estilos em ui.css (.panel-footer): safe-area do iPhone, botões lado a lado
  // no celular (secundário + primário, antes empilhados ocupando ~130px) e
  // fundo que acompanha o modo escuro.
  return (
    <div className="panel-footer">
      {left || (!isCompact && <div />)}
      <div className="panel-footer__right">
        {right}
      </div>
    </div>
  );
}

// ── ValidationBanner ──────────────────────────────────────────────────────────

interface ValidationBannerProps { show: boolean; children: ReactNode; }

export function ValidationBanner({ show, children }: ValidationBannerProps) {
  const { isMobile, isTablet } = useResponsive();
  const px = isMobile ? 16 : isTablet ? 24 : 40;

  if (!show) return null;
  return (
    <div style={{
      background: tokens.color.critBg,
      borderBottom: `1px solid ${tokens.color.critBorder}`,
      padding: `11px ${px}px`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      animation: 'fadeUp 0.2s ease forwards',
    }}>
      <svg
        width={14} height={14}
        viewBox="0 0 14 14"
        fill="none"
        stroke={tokens.color.crit}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M7 1L13 12H1L7 1z" />
        <line x1="7" y1="5.5" x2="7" y2="8.5" />
        <circle cx="7" cy="10.5" r="0.5" fill={tokens.color.crit} />
      </svg>
      <span role="alert" style={{ fontFamily: tokens.fontSans, fontSize: '0.8125rem', fontWeight: 500, color: tokens.color.crit }}>
        {children}
      </span>
    </div>
  );
}

// ── PhotoGrid ─────────────────────────────────────────────────────────────────

interface Photo { src: string; name: string; }

interface PhotoGridProps {
  photos: Photo[];
  handlePhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
  onPreview: (src: string) => void;
}

export function PhotoGrid({ photos, handlePhotos, onRemove, onPreview }: PhotoGridProps) {
    const { isMobile } = useResponsive();
  // Slightly larger thumb on desktop, compact on mobile
  const thumbSize = isMobile ? 72 : 88;
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
         {/* Upload trigger */}
        <label
          style={{
            width: thumbSize, height: thumbSize,
            border: `1.5px dashed ${tokens.color.borderMd}`,
            background: tokens.color.bgAlt,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: tokens.radius.md,
            flexShrink: 0,
            transition: tokens.transition.base,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = tokens.color.ferrari;
            (e.currentTarget as HTMLElement).style.background  = tokens.color.ferrariMid;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = tokens.color.borderMd;
            (e.currentTarget as HTMLElement).style.background  = tokens.color.bgAlt;
          }}
        >
          <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={tokens.color.muted} strokeWidth={1.4} strokeLinecap="round">
            <rect x={1.5} y={4} width={15} height={11} rx={2} />
            <circle cx={9} cy={9.5} r={2.8} />
            <path d="M6 4l1.2-2h3.6L12 4" />
          </svg>
          <span style={{
            fontFamily: tokens.fontSans,
            fontSize: '0.75rem',
            fontWeight: 600,
            color: tokens.color.subtle,
          }}>
            Foto
          </span>
          <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: 'none' }} />
        </label>
        {/* Thumbnails */}
        {photos.map((photo, i) => (
          <div
            key={i}
            style={{
              width: thumbSize, height: thumbSize,
              overflow: 'hidden',
              position: 'relative',
              borderRadius: tokens.radius.md,
              flexShrink: 0,
              border: `1px solid ${tokens.color.border}`,
            }}
          >
            <img
              src={photo.src}
              alt={photo.name}
              onClick={() => onPreview(photo.src)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
            />
            <button
              type="button"
              className="tap-area"
              onClick={() => onRemove(i)}
              style={{
                position: 'absolute', top: 4, right: 4,
                width: 24, height: 24,
                background: 'rgba(255,255,255,0.9)',
                color: tokens.color.textSecond,
                border: `1px solid ${tokens.color.border}`,
                cursor: 'pointer',
                fontSize: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                backdropFilter: 'blur(4px)',
                boxShadow: tokens.shadow.xs,
              }}
              aria-label={`Remover foto ${photo.name}`}
            >
              <svg width={8} height={8} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <line x1="1" y1="1" x2="7" y2="7" /><line x1="7" y1="1" x2="1" y2="7" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: tokens.fontSans, fontSize: '0.75rem', color: tokens.color.subtle, marginTop: 10 }}>
        {photos.length === 0
          ? 'Nenhuma foto adicionada'
          : `${photos.length} foto${photos.length > 1 ? 's' : ''} adicionada${photos.length > 1 ? 's' : ''}`}
      </p>
    </>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps { src: string | null; onClose: () => void; }

export function Lightbox({ src, onClose }: LightboxProps) {
   // Close on Escape key
  useEffect(() => {
    if (!src) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [src, onClose]);


  if (!src) return null;
  return (
    <div
      onClick={onClose}
      style={{
        display: 'flex',
        position: 'fixed', inset: 0,
        background: 'rgba(26,26,26,0.88)',
        zIndex: 'var(--z-modal)' as unknown as number,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,           // breathing room on small screens
        animation: 'fadeIn 0.18s ease forwards',
        backdropFilter: 'blur(6px)',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', right: 16,
          background: 'rgba(255,255,255,0.16)',
          border: '1px solid rgba(255,255,255,0.28)',
          color: '#fff',
          width: 44, height: 44,
          cursor: 'pointer',
          fontFamily: tokens.fontSans,
          fontSize: '1.5rem',
          lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: tokens.radius.md,
        }}
        aria-label="Fechar"
      >
        ×
      </button>
      <img
        src={src}
        alt="Pré-visualização"
        style={{
          maxWidth: '100%', maxHeight: '90dvh',   // dvh: acompanha a barra de endereço do mobile
          display: 'block',
          borderRadius: tokens.radius.lg,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          animation: 'scaleIn 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── StatBadge ─────────────────────────────────────────────────────────────────

interface StatBadgeProps { value: number; label: string; color: string; }

export function StatBadge({ value, label, color }: StatBadgeProps) {
  return (
    <div style={{ textAlign: 'center', minWidth: 44 }}>
      <span style={{
        fontFamily: tokens.fontMono,
        fontSize: '1.5rem',
        fontWeight: 300,
        lineHeight: 1,
        display: 'block',
        color,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </span>
      <span style={{
        fontFamily: tokens.fontSans,
        fontSize: '0.75rem',
        color: tokens.color.subtle,
        marginTop: 4,
        display: 'block',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── SectionIcon ─────────────────────

interface SectionIconProps { id: string; size?: number; }

export function SectionIcon({ id, size = 16 }: SectionIconProps) {
  const s = size;
  const stroke = tokens.color.muted;
  const sw = 1.4;

  const icons: Record<string, JSX.Element> = {
    motor: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <rect x="2" y="5" width="12" height="7" rx="1.5"/>
        <path d="M5 5V3M11 5V3"/><path d="M2 8.5H0M16 8.5H14"/><circle cx="8" cy="8.5" r="1.8"/>
      </svg>
    ),
    freios: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/>
        <line x1="8" y1="2" x2="8" y2="5.5"/><line x1="8" y1="10.5" x2="8" y2="14"/>
        <line x1="2" y1="8" x2="5.5" y2="8"/><line x1="10.5" y1="8" x2="14" y2="8"/>
      </svg>
    ),
    suspensao: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <line x1="4" y1="2" x2="4" y2="14"/><line x1="12" y1="2" x2="12" y2="14"/>
        <path d="M4 5h4a2 2 0 0 1 0 4H4"/><circle cx="4" cy="13" r="1.5"/><circle cx="12" cy="13" r="1.5"/>
      </svg>
    ),
    eletrica: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="9,2 3,9 7.5,9 7,14 13,7 8.5,7"/>
      </svg>
    ),
    transmissao: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <circle cx="3.5" cy="5" r="2"/><circle cx="12.5" cy="5" r="2"/>
        <circle cx="8" cy="12" r="2"/>
        <line x1="5.5" y1="5" x2="10.5" y2="5"/>
        <line x1="4" y1="6.8" x2="7" y2="10.2"/>
        <line x1="12" y1="6.8" x2="9" y2="10.2"/>
      </svg>
    ),
    pneus: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
        <circle cx="8" cy="8" r="6.5"/><circle cx="8" cy="8" r="3"/>
        <line x1="8" y1="1.5" x2="8" y2="5"/><line x1="8" y1="11" x2="8" y2="14.5"/>
        <line x1="1.5" y1="8" x2="5" y2="8"/><line x1="11" y1="8" x2="14.5" y2="8"/>
      </svg>
    ),
    carroceria: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 11V8l2.5-4h9L15 8v3H1z"/>
        <circle cx="4" cy="11" r="1.8"/><circle cx="12" cy="11" r="1.8"/>
        <path d="M4 8h8"/>
      </svg>
    ),
    interior: (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6"/>
        <path d="M1 14h14"/><path d="M5 6V4a3 3 0 0 1 6 0v2"/>
        <line x1="8" y1="9" x2="8" y2="12"/>
      </svg>
    ),
  };

  return icons[id] ?? (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/><line x1="8" y1="5" x2="8" y2="9"/><circle cx="8" cy="11.5" r="0.75" fill={stroke} stroke="none"/>
    </svg>
  );
}

import { useState, CSSProperties, ReactNode } from 'react';
import { tokens } from '../constants';

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
};

export const inpError: CSSProperties = {
  ...inp,
  borderColor: tokens.color.crit,
  background: tokens.color.critBg,
};

export const inpStyle = (hasError: boolean): CSSProperties =>
  hasError ? inpError : inp;

export const grid3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '14px 18px',
};

export const grid4: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '14px 18px',
};

const baseBtn: CSSProperties = {
  fontFamily: tokens.fontMono,
  fontSize: '0.72rem',
  fontWeight: 500,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
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
export const btnDisabled: CSSProperties = { ...baseBtn, background: tokens.color.surfaceHigh, color: tokens.color.ghost, cursor: 'not-allowed', border: `1px solid ${tokens.color.border}` };

export const pfNote: CSSProperties = {
  fontFamily: tokens.fontMono,
  fontSize: '0.67rem',
  color: tokens.color.subtle,
};

// ── SectionTitle ──────────────────────────────────────────────────────────────

interface SectionTitleProps { children: ReactNode; }

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div style={{
      fontFamily: tokens.fontMono,
      fontSize: '0.62rem',
      fontWeight: 500,
      letterSpacing: '0.13em',
      textTransform: 'uppercase',
      color: tokens.color.subtle,
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
  return (
    <div style={{
      background: tokens.color.surface,
      borderBottom: noBorder ? 'none' : `1px solid ${tokens.color.border}`,
      padding: '26px 40px',
    }}>
      {title && <SectionTitle>{title}</SectionTitle>}
      {children}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  span?: number;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, span, hint, children }: FieldProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      gridColumn: span ? `span ${span}` : undefined,
    }}>
      <label style={{
        fontFamily: tokens.fontMono,
        fontSize: '0.6rem',
        fontWeight: 500,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
     
      {hint && (
        <span style={{
          fontFamily: tokens.fontMono,
          fontSize: '0.58rem',
          color: tokens.color.ghost,
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
  return (
    <div style={{
      padding: '14px 40px',
      background: 'rgba(247,246,243,0.92)',
      borderTop: `1px solid ${tokens.color.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      bottom: 0,
      zIndex: 100,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      {left || <div />}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{right}</div>
    </div>
  );
}

// ── ValidationBanner ──────────────────────────────────────────────────────────

interface ValidationBannerProps { show: boolean; children: ReactNode; }

export function ValidationBanner({ show, children }: ValidationBannerProps) {
  if (!show) return null;
  return (
    <div style={{
      background: tokens.color.critBg,
      borderBottom: `1px solid ${tokens.color.critBorder}`,
      padding: '11px 40px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      animation: 'fadeUp 0.2s ease forwards',
    }}>
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke={tokens.color.crit} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 1L13 12H1L7 1z" /><line x1="7" y1="5.5" x2="7" y2="8.5" /><circle cx="7" cy="10.5" r="0.5" fill={tokens.color.crit} />
      </svg>
      <span style={{ fontFamily: tokens.fontMono, fontSize: '0.75rem', color: tokens.color.crit }}>{children}</span>
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
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <label
          style={{
            width: 88, height: 88,
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
            fontFamily: tokens.fontMono,
            fontSize: '0.58rem',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: tokens.color.subtle,
          }}>
            Foto
          </span>
          <input type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: 'none' }} />
        </label>

        {photos.map((photo, i) => (
          <div
            key={i}
            className="photo-thumb"
            style={{
              width: 88, height: 88,
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
              onClick={() => onRemove(i)}
              style={{
                position: 'absolute', top: 4, right: 4,
                width: 20, height: 20,
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

      <p style={{ fontFamily: tokens.fontMono, fontSize: '0.62rem', color: tokens.color.subtle, marginTop: 10 }}>
        {photos.length === 0 ? 'Nenhuma foto adicionada' : `${photos.length} foto${photos.length > 1 ? 's' : ''} adicionada${photos.length > 1 ? 's' : ''}`}
      </p>
    </>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

interface LightboxProps { src: string | null; onClose: () => void; }

export function Lightbox({ src, onClose }: LightboxProps) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      style={{
        display: 'flex',
        position: 'fixed', inset: 0,
        background: 'rgba(26,26,26,0.88)',
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.18s ease forwards',
        backdropFilter: 'blur(6px)',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 22, right: 26,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.8)',
          width: 34, height: 34,
          cursor: 'pointer',
          fontFamily: tokens.fontMono,
          fontSize: '0.65rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: tokens.radius.md,
          letterSpacing: '0.05em',
        }}
        aria-label="Fechar"
      >
        ESC
      </button>
      <img
        src={src}
        alt="Pré-visualização"
        style={{
          maxWidth: '88vw', maxHeight: '88vh',
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
        fontFamily: tokens.fontMono,
        fontSize: '0.56rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: tokens.color.subtle,
        marginTop: 4,
        display: 'block',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Tag (section icon replacement) ───────────────────────────────────────────

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

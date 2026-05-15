import { useState } from 'react';
import { STEP_LABELS, tokens } from '../constants';

const STEP_ICONS = [
  // 1 — Identificação
  <svg key="1" width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <rect x="1.5" y="1.5" width="10" height="10" rx="2"/>
    <line x1="4" y1="4.5" x2="9" y2="4.5"/>
    <line x1="4" y1="6.5" x2="9" y2="6.5"/>
    <line x1="4" y1="8.5" x2="7" y2="8.5"/>
  </svg>,
  // 2 — Fotos
  <svg key="2" width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <rect x="1.5" y="3.5" width="10" height="7.5" rx="1.5"/>
    <circle cx="6.5" cy="7.2" r="2"/>
    <path d="M4.5 3.5l1-1.5h2l1 1.5"/>
  </svg>,
  // 3 — Encerramento
  <svg key="3" width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <path d="M6.5 1.5v5.2M4 3l2.5 3.5L9 3"/>
    <path d="M2 9.5h9a1 1 0 0 1 0 2H2a1 1 0 0 1 0-2z"/>
  </svg>,
];

interface StepTabsProps {
  step: number;
  onGoStep: (n: number) => void;
}

export function StepTabs({ step, onGoStep }: StepTabsProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{
      background: tokens.color.surface,
      borderBottom: `1px solid ${tokens.color.border}`,
      padding: '0 40px',
      display: 'flex',
      overflowX: 'auto',
      position: 'relative',
      boxShadow: tokens.shadow.xs,
    }}>
      {STEP_LABELS.map((label, i) => {
        const n       = i + 1;
        const active  = step === n;
        const done    = step > n;
        const isHover = hovered === n;

        return (
          <button
            key={n}
            onClick={() => onGoStep(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '14px 20px 13px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${
                active  ? tokens.color.ferrari :
                isHover ? tokens.color.borderHigh :
                'transparent'
              }`,
              fontFamily: tokens.fontSans,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'border-color 0.18s ease',
              position: 'relative',
            }}
          >
            <span
              className="step-badge"
              style={{
                width: 22, height: 22,
                borderRadius: '50%',
                border: `1.5px solid ${
                  done    ? tokens.color.ok :
                  active  ? tokens.color.ferrari :
                  isHover ? tokens.color.borderHigh :
                  tokens.color.border
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: tokens.fontMono,
                fontSize: '0.6rem',
                fontWeight: 600,
                color: done ? '#fff' : active ? '#fff' : tokens.color.subtle,
                background: done ? tokens.color.ok : active ? tokens.color.ferrari : 'transparent',
                flexShrink: 0,
                boxShadow: active ? `0 0 0 3px ${tokens.color.accentDim}` : 'none',
              }}
            >
              {done ? (
                <svg width={9} height={9} viewBox="0 0 9 9" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" />
                </svg>
              ) : (
                <span style={{ lineHeight: 1 }}>{n}</span>
              )}
            </span>

            <span style={{
              fontSize: '0.83rem',
              fontWeight: active ? 500 : 400,
              color: active ? tokens.color.text : isHover ? tokens.color.textSecond : tokens.color.muted,
              transition: 'color 0.15s ease',
            }}>
              {label}
            </span>

            {active && (
              <span style={{ color: tokens.color.ferrari, opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                {STEP_ICONS[i]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
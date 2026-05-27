import { useState } from 'react';
import { STEP_LABELS } from '../constants';
import '../styles/steptabs.css';

const STEP_ICONS = [
  <svg key="1" width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <rect x="1.5" y="1.5" width="10" height="10" rx="2" />
    <line x1="4" y1="4.5" x2="9" y2="4.5" />
    <line x1="4" y1="6.5" x2="9" y2="6.5" />
    <line x1="4" y1="8.5" x2="7" y2="8.5" />
  </svg>,
  <svg key="2" width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <rect x="1.5" y="3.5" width="10" height="7.5" rx="1.5" />
    <circle cx="6.5" cy="7.2" r="2" />
    <path d="M4.5 3.5l1-1.5h2l1 1.5" />
  </svg>,
  <svg key="3" width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <path d="M6.5 1.5v5.2M4 3l2.5 3.5L9 3" />
    <path d="M2 9.5h9a1 1 0 0 1 0 2H2a1 1 0 0 1 0-2z" />
  </svg>,
];

interface StepTabsProps {
  step: number;
  onGoStep: (n: number) => void;
}

export function StepTabs({ step, onGoStep }: StepTabsProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="step-tabs">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        const isHover = hovered === n;

        const tabClasses = [
          'step-tab',
          active ? 'step-tab--active' : undefined,
          done ? 'step-tab--done' : undefined,
          isHover ? 'step-tab--hover' : undefined,
        ]
          .filter(Boolean)
          .join(' ');

        const badgeClasses = [
          'step-badge',
          done ? 'step-badge--done' : undefined,
          active ? 'step-badge--active' : undefined,
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={n}
            type="button"
            className={tabClasses}
            onClick={() => onGoStep(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className={badgeClasses}>
              {done ? (
                <svg width={9} height={9} viewBox="0 0 9 9" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" />
                </svg>
              ) : (
                <span>{n}</span>
              )}
            </span>
            <span className="step-tab__label">{label}</span>
            {active && <span className="step-tab__icon">{STEP_ICONS[i]}</span>}
          </button>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import '../styles/steptabs.css';

interface StepItem {
  id: number;
  label: string;
  icon?: React.ReactNode;
}

interface StepTabsProps {
  step: number;
  onGoStep: (n: number) => void;
  steps: StepItem[];
}

export function StepTabs({ step, onGoStep, steps }: StepTabsProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="step-tabs">
      {steps.map((item) => {
        const n = item.id;
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
            <span className="step-tab__label">{item.label}</span>
            {active && item.icon && (
  <span className="step-tab__icon">
    {item.icon}
  </span>
)}
          </button>
        );
      })}
    </div>
  );
}

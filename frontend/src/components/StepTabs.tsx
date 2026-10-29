import { useEffect, useRef, useState } from 'react';
import { useResponsive } from './ui';
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
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const { isMobile } = useResponsive();

  // No celular as abas rolam na horizontal: traz a etapa atual para a tela
  // (antes a etapa 3/4 podia ficar escondida fora da área visível).
  useEffect(() => {
    if (isMobile) return;   // no celular só existe a etapa atual, não há o que rolar
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest',
    });
  }, [step, isMobile]);

  // Celular: só a etapa atual, centralizada no topo, sem rolagem horizontal.
  // A troca de etapa é feita pelos botões "Voltar/Próximo" do rodapé.
  if (isMobile) {
    const atual = steps.find(s => s.id === step) ?? steps[0];
    if (!atual) return null;
    return (
      <div className="step-tabs step-tabs--mobile" role="status" aria-live="polite">
        <span className="step-tab step-tab--active step-tab--static" aria-current="step">
          <span className="step-badge step-badge--active"><span>{atual.id}</span></span>
          <span className="step-tab__label">{atual.label}</span>
          {atual.icon && <span className="step-tab__icon">{atual.icon}</span>}
        </span>
      </div>
    );
  }

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
            ref={active ? activeRef : undefined}
            type="button"
            aria-current={active ? 'step' : undefined}
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

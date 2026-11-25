import { useRef, useEffect } from 'react';
import type { useOrdemServico } from '../hooks/useOrdemServico';
import { exportPDF } from '../utils/exportPDF';
import { Topbar } from '../components/Topbar';
import { StepTabs } from '../components/StepTabs';
import { Lightbox } from '../components/ui';
import { DiagnosticoConfig } from '../features/Checklist/configs/inspection';
import { tokens } from '../constants';

interface Check2Props {
  /** Estado da OS — o mesmo da etapa 1 e do orçamento (vive no App). */
  os: ReturnType<typeof useOrdemServico>;
  onBackToStart?: () => void;
  /** Vai para a etapa 3 (orçamento). */
  onNextChecklist?: () => void;
  /** Volta para o checklist anterior (Entrada) — usado pelo "Voltar" na primeira etapa. */
  onPrevChecklist?: () => void;
}

export default function Check2({ os, onBackToStart, onNextChecklist, onPrevChecklist }: Check2Props) {

  // Auto-scroll active tab into view when step changes
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const activeBtn = tabsRef.current?.querySelector('.step-tab--active') as HTMLElement | null;
    activeBtn?.scrollIntoView({ inline: 'nearest', behavior: 'smooth', block: 'nearest' });
  }, [os.step]);

  const currentStep = DiagnosticoConfig.find((s) => s.id === os.step);

  const handleExportPDF = () => {
    exportPDF(
      os.osHeader,
      os.cliente,
      os.veiculo,
      os.tecnico,
      os.photos,
      os.getSigImage(),
    );
  };

  const CurrentComponent = currentStep?.component;

  // "Voltar" da barra superior: uma etapa para trás; na primeira, volta ao checklist
  // anterior (Entrada) ou, sem ele, à visão geral.
  const handleBackStep = () => {
    if (os.step > 1) os.goStep(os.step - 1, os.step);
    else (onPrevChecklist ?? onBackToStart)?.();
  };

  return (
    <div style={{
      fontFamily: tokens.fontSans,
      background: tokens.color.bg,
      minHeight: '100dvh',
      paddingBottom: 'var(--mobile-bottom-nav-h)',
    }}>
      <Topbar
        saveStatus={os.saveStatus}
        savedAt={os.savedAt}
        onReset={os.resetAll}
        onExportPDF={handleExportPDF}
        onBackToStart={onBackToStart}
        onBackStep={handleBackStep}
        backAriaLabel={
          os.step > 1 ? 'Voltar uma etapa' : onPrevChecklist ? 'Voltar para a Entrada' : 'Voltar para a visão geral'
        }
      />
      <div ref={tabsRef}>
        <StepTabs
          step={os.step}
          onGoStep={(n) => os.goStep(n, os.step)}
          steps={DiagnosticoConfig}
        />
      </div>

      {CurrentComponent && (
        <CurrentComponent os={os} onExportPDF={handleExportPDF} onNextChecklist={onNextChecklist} />
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
import { useRef, useEffect } from 'react';
import { useOrdemServico } from '../hooks/useOrdemServico';
import { exportPDF } from '../utils/exportPDF';
import { Topbar } from '../components/Topbar';
import { StepTabs } from '../components/StepTabs';
import { Lightbox } from '../components/ui';
import { DiagnosticoConfig } from '../features/Checklist/configs/inspection';
import { tokens } from '../constants';
import type { OrdemServico } from '../types';

interface Check2Props {
  initialOrdem?: (OrdemServico & { id: string }) | null;
  onBackToStart?: () => void;
}

export default function Check2({ initialOrdem, onBackToStart }: Check2Props) {
  const os = useOrdemServico();

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

  return (
    <div style={{
      fontFamily: tokens.fontSans,
      background: tokens.color.bg,
      minHeight: '100vh',
      paddingBottom: 80,
    }}>
      <Topbar
        saveStatus={os.saveStatus}
        savedAt={os.savedAt}
        onReset={os.resetAll}
        onExportPDF={handleExportPDF}
        onBackToStart={onBackToStart}
      />
      <div ref={tabsRef}>
        <StepTabs
          step={os.step}
          onGoStep={(n) => os.goStep(n, os.step)}
          steps={DiagnosticoConfig}
        />
      </div>

      {CurrentComponent && (
        <CurrentComponent os={os} onExportPDF={handleExportPDF} />
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
import { useEffect } from 'react';
import { useOrdemServico } from '../hooks/useOrdemServico';
import { exportPDF } from '../utils/exportPDF';
import { Topbar } from '../components/Topbar';
import { StepTabs } from '../components/StepTabs';
import { Lightbox } from '../components/ui';
import { entradaConfig } from '../features/Checklist/configs/initial';
import { tokens } from '../constants';
import type { OrdemServico } from '../types';

interface CheckProps {
  initialOrdem?: (OrdemServico & { id: string }) | null;
  onBackToStart?: () => void;
}

export default function Check({ initialOrdem, onBackToStart }: CheckProps) {
  const os = useOrdemServico();

  useEffect(() => {
    if (initialOrdem) os.loadOrder(initialOrdem);
  }, [initialOrdem]);

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

  const currentStep = entradaConfig.find((s) => s.id === os.step);
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
      <StepTabs step={os.step} onGoStep={(n) => os.goStep(n, os.step)} />

      {CurrentComponent && (
        <CurrentComponent os={os} onExportPDF={handleExportPDF} />
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
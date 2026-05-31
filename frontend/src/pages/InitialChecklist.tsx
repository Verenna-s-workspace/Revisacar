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
  onNextChecklist?: () => void;
}

export default function Check({ initialOrdem, onBackToStart, onNextChecklist }: CheckProps) {
  const os = useOrdemServico();

  const currentStep = entradaConfig.find((s) => s.id === os.step);

  // Chama initSig automaticamente sempre que o step ativo tiver hasSignature
  useEffect(() => {
    if (currentStep?.hasSignature) os.initSig();
  }, [os.step]);

  // ... resto igual

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
     
<StepTabs
  step={os.step}
  onGoStep={(n) => os.goStep(n, os.step)}
  steps={entradaConfig}
/>

      {CurrentComponent && (
        <CurrentComponent
      os={os}
      onExportPDF={handleExportPDF}
      onNextChecklist={onNextChecklist}  // ← new
    />
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
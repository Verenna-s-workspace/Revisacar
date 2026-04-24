import { useEffect } from 'react';
import { useOrdemServico } from '../hooks/useOrdemServico';
import { exportPDF } from '../utils/exportPDF';
import { Topbar } from '../components/Topbar';
import { StepTabs } from '../components/StepTabs';
import { Lightbox } from '../components/ui';
import { Step1, Step2, Step3, Step4, Step5 } from '../components/Steps';
import { tokens } from '../constants';
import type { OrdemServico } from '../types';

interface HomeProps {
  initialOrdem?: OrdemServico & { id: string } | null;
  onBackToStart?: () => void;
}

export default function Home({ initialOrdem, onBackToStart }: HomeProps) {
  const os = useOrdemServico();

  // Carregar ordem se houver
  useEffect(() => {
    if (initialOrdem) {
      os.loadOrder(initialOrdem);
    }
  }, [initialOrdem, os.loadOrder]);

  const handleExportPDF = () => {
    exportPDF(
      os.osHeader,
      os.cliente,
      os.veiculo,
      os.tecnico,
      os.selected,
      os.checklist,
      os.photos,
      os.itensAdicionais,
      os.getSigImage(),
    );
  };

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

      {os.step === 1 && (
        <Step1
          osHeader={os.osHeader}     setOsHeader={os.setOsHeader}
          cliente={os.cliente}       setCliente={os.setCliente}
          veiculo={os.veiculo}       setVeiculo={os.setVeiculo}
          photos={os.photos}
          handlePhotos={os.handlePhotos}
          removePhoto={os.removePhoto}
          setLightbox={os.setLightbox}
          savedAt={os.savedAt}
          showErrors={os.showErrors}
          errors={os.errors}
          onSave={os.saveOrder}
          onNext={os.handleNextStep1}
          stepDir={os.stepDir}
        />
      )}

      {os.step === 2 && (
        <Step2
          selected={os.selected}
          onToggle={os.toggleSection}
          onToggleAll={os.toggleAllSections}
          onBack={() => os.goStep(1, os.step)}
          onNext={() => os.goStep(3, os.step)}
          stepDir={os.stepDir}
        />
      )}

      {os.step === 3 && (
        <Step3
          selected={os.selected}
          checklist={os.checklist}
          stats={os.stats}
          onSetStatus={os.setChecklistStatus}
          onSetObs={os.setChecklistObs}
          // ↓ itens dinâmicos agora vêm do hook
          itensAdicionais={os.itensAdicionais}
          onAddItem={os.addDynamicItem}
          onRemoveItem={os.removeDynamicItem}
          savedAt={os.savedAt}
          onSave={os.saveOrder}
          onBack={() => os.goStep(2, os.step)}
          onNext={() => os.goStep(4, os.step)}
          stepDir={os.stepDir}
        />
      )}

      {os.step === 4 && (
        <Step4
          photos={os.photos}
          handlePhotos={os.handlePhotos}
          removePhoto={os.removePhoto}
          setLightbox={os.setLightbox}
          onBack={() => os.goStep(3, os.step)}
          onNext={() => os.goStep(5, os.step)}
          stepDir={os.stepDir}
        />
      )}

      {os.step === 5 && (
        <Step5
          veiculo={os.veiculo}
          cliente={os.cliente}
          selected={os.selected}
          stats={os.stats}
          critItems={os.critItems}
          photos={os.photos}
          tecnico={os.tecnico}
          setTecnico={os.setTecnico}
          showErrors={os.showErrors}
          errors={os.errors}
          sigRef={os.sigRef}
          sigHandlers={os.sigHandlers}
          onClearSig={os.clearSig}
          savedAt={os.savedAt}
          onSave={os.saveOrder}
          onBack={() => os.goStep(4, os.step)}
          onExport={() => os.handleExport(handleExportPDF)}
          stepDir={os.stepDir}
        />
      )}

      <Lightbox src={os.lightbox} onClose={() => os.setLightbox(null)} />
    </div>
  );
}
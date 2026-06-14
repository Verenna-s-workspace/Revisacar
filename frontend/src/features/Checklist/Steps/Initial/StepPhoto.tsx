import { useState } from 'react';
import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { CameraCapture } from '../../../../components/Camera/CameraCapture';
import { tokens } from '../../../../constants';
import {
  FormBlock, PanelFooter, PhotoGrid, btnGhost, btnAccent,
} from '../../../../components/ui';

interface StepProps {
  os: ReturnType<typeof useOrdemServico>;
  onExportPDF?: () => void;
}

function StepWrapper({ children, direction = 'forward' }: {
  children: React.ReactNode;
  direction?: 'forward' | 'back';
}) {
  return (
    <div
      className={direction === 'forward' ? 'step-enter' : 'step-enter-left'}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </div>
  );
}

export function Step2({ os }: StepProps) {
  const {
    photos, handlePhotos, removePhoto,
    setLightbox, addPhotoFromCamera,
    goStep, step, stepDir,
  } = os;

  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <StepWrapper direction={stepDir}>
      <FormBlock title="Registro Fotográfico da Inspeção">
        <p style={{
          fontFamily: tokens.fontMono,
          fontSize: '0.65rem',
          color: tokens.color.muted,
          marginBottom: 18,
        }}>
          Fotografe pontos de atenção, defeitos e condições do veículo. As fotos
          serão incluídas no relatório PDF.
        </p>

        <button
          onClick={() => setCameraOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 18,
            padding: '10px 18px',
            background: tokens.color.accentDim,
            border: `1.5px solid ${tokens.color.ferrari}`,
            borderRadius: tokens.radius.lg,
            color: tokens.color.ferrari,
            fontFamily: tokens.fontMono,
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(204,20,0,0.10)',
            transition: tokens.transition.base,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Tirar foto com a câmera
        </button>

        <PhotoGrid
          photos={photos}
          handlePhotos={handlePhotos}
          onRemove={removePhoto}
          onPreview={(src) => setLightbox(src)}
        />
      </FormBlock>

      <PanelFooter
        left={null}
        right={
          <>
            <button onClick={() => goStep(1, step)} style={btnGhost}>
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={() => goStep(3, step)} style={btnAccent}>
              Encerramento
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />

      {cameraOpen && (
        <CameraCapture
          onCapture={(photo) => {
            addPhotoFromCamera(photo);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </StepWrapper>
  );
}
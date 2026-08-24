import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { tokens } from '../../constants';
import type { Photo } from '../../types';

interface CameraCaptureProps {
  onCapture: (photo: Photo) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  // Detect if device has more than one camera (front + back)
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoCams = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoCams.length > 1);
      })
      .catch(() => setHasMultipleCameras(false));
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const capture = useCallback(() => {
    const src = webcamRef.current?.getScreenshot({ width: 1280, height: 960 });
    if (src) setCaptured(src);
  }, []);

  const confirm = useCallback(() => {
    if (!captured) return;
    onCapture({ src: captured, name: `foto_${Date.now()}.jpg`, path: undefined });
    onClose();
  }, [captured, onCapture, onClose]);

  const retake = () => setCaptured(null);

  const toggleFacingMode = () =>
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));

  return (
    /* ── Overlay ── */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0,0,0,0.96)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {captured ? 'Confirmar foto' : 'Câmera'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: tokens.fontMono,
            fontSize: '0.62rem',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: '6px 14px',
            transition: tokens.transition.fast,
          }}
        >
          ✕ Fechar
        </button>
      </div>

      {/* Viewfinder / Preview */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1.5px solid rgba(255,255,255,0.1)',
          background: '#111',
          aspectRatio: '4/3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {camError ? (
          <div
            style={{
              color: tokens.color.crit,
              fontFamily: tokens.fontMono,
              fontSize: '0.72rem',
              textAlign: 'center',
              padding: 24,
            }}
          >
            {camError}
          </div>
        ) : captured ? (
          <img
            src={captured}
            alt="Prévia"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            videoConstraints={{ facingMode, aspectRatio: 4 / 3 }}
            onUserMediaError={() =>
              setCamError('Não foi possível acessar a câmera.\nVerifique as permissões do navegador.')
            }
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* Corner marks for viewfinder feel */}
        {!captured && !camError && (
          <>
            {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
              <span
                key={pos}
                style={{
                  position: 'absolute',
                  width: 20,
                  height: 20,
                  borderColor: 'rgba(255,255,255,0.55)',
                  borderStyle: 'solid',
                  borderWidth: 0,
                  ...(pos === 'tl' && { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2 }),
                  ...(pos === 'tr' && { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2 }),
                  ...(pos === 'bl' && { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2 }),
                  ...(pos === 'br' && { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2 }),
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          marginTop: 22,
          width: '100%',
          maxWidth: 640,
        }}
      >
        {!captured ? (
          <>
            {/* Flip camera — only shown if multiple cameras */}
            {hasMultipleCameras && (
              <button
                onClick={toggleFacingMode}
                title="Virar câmera"
                style={iconBtn}
              >
                {/* Rotate icon */}
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
                </svg>
              </button>
            )}

            {/* Shutter */}
            <button
              onClick={capture}
              title="Capturar"
              disabled={!!camError}
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: camError ? 'rgba(255,255,255,0.1)' : '#fff',
                border: '3px solid rgba(255,255,255,0.3)',
                cursor: camError ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: camError ? 'none' : '0 0 0 6px rgba(255,255,255,0.1)',
                transition: 'box-shadow 0.15s, transform 0.12s',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: camError ? 'rgba(255,255,255,0.2)' : tokens.color.ferrari,
                  display: 'block',
                }}
              />
            </button>

            {/* Spacer to balance flip button */}
            {hasMultipleCameras && <div style={{ width: 48, height: 48 }} />}
          </>
        ) : (
          <>
            {/* Retake */}
            <button onClick={retake} style={ghostBtn}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.5L1 10" />
              </svg>
              Tirar novamente
            </button>

            {/* Confirm */}
            <button onClick={confirm} style={confirmBtn}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Usar foto
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Local button styles ────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'background 0.15s',
};

const ghostBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 20px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.7)',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '0.72rem',
  letterSpacing: '0.05em',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const confirmBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 28px',
  background: tokens.color.ferrari,
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  cursor: 'pointer',
  boxShadow: '0 2px 12px rgba(204,20,0,0.35)',
  transition: 'opacity 0.15s',
};

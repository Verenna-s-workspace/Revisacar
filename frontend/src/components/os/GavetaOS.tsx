import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './os-fase.css';

interface GavetaOSProps {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
}

const IcX = <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;

/** Gaveta lateral genérica (Histórico da OS; serve para outras fases). Esc e toque fora fecham; foco volta ao botão que abriu. */
export function GavetaOS({ titulo, onFechar, children }: GavetaOSProps) {
  const fechar = useRef<HTMLButtonElement>(null);
  const antes = useRef<Element | null>(null);

  useEffect(() => {
    antes.current = document.activeElement;
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      (antes.current as HTMLElement | null)?.focus?.();
    };
  }, [onFechar]);

  return createPortal(
    <div className="osf-gaveta" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="osf-gaveta__painel" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="osf-gaveta__topo">
          <h2 className="osf-gaveta__titulo">{titulo}</h2>
          <button type="button" ref={fechar} className="osf-icbtn" aria-label={`Fechar ${titulo.toLowerCase()}`} onClick={onFechar}>{IcX}</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

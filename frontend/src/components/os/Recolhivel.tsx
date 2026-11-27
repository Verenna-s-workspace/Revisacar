import { useId, useState, type ReactNode } from 'react';
import './os-fase.css';

interface RecolhivelProps {
  titulo: string;
  /** Texto curto ao lado do título (ex.: "automáticos"). */
  nota?: string;
  /** Mantém aberto (ex.: falta um dado obrigatório lá dentro). */
  forcarAberto?: boolean;
  children: ReactNode;
}

const IcSeta = (aberto: boolean) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: aberto ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Bloco recolhido de campos secundários: botão real com aria-expanded, alvo ≥ 44px. */
export function Recolhivel({ titulo, nota, forcarAberto = false, children }: RecolhivelProps) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const visivel = aberto || forcarAberto;
  return (
    <div className="osf-rec">
      <button type="button" className="osf-rec__btn" aria-expanded={visivel} aria-controls={id} onClick={() => setAberto((v) => !v)} disabled={forcarAberto}>
        <span className="osf-rec__t">{titulo}</span>
        {nota && <span className="osf-rec__n">{nota}</span>}
        {IcSeta(visivel)}
      </button>
      {visivel && <div id={id} className="osf-rec__corpo">{children}</div>}
    </div>
  );
}

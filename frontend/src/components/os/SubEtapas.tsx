import { useEffect, useRef } from 'react';
import type { EtapaFase } from '../../utils/os_fases';
import { IconeEtapa, textoEstado } from './IconeEtapa';
import './os-fase.css';

interface SubEtapasProps {
  etapas: readonly EtapaFase[];
  atual: number;
  onSelecionar: (id: number) => void;
  rotuloNav?: string;
}

/** Sub-etapas da fase atual (substituem as abas antigas). Bloqueada = desabilitada; estado em texto para leitor de tela. */
export function SubEtapas({ etapas, atual, onSelecionar, rotuloNav = 'Etapas da fase' }: SubEtapasProps) {
  const ativoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ativoRef.current?.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  }, [atual]);

  return (
    <nav aria-label={rotuloNav}>
      <ol className="osf-sub">
        {etapas.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              ref={e.id === atual ? ativoRef : undefined}
              className="osf-sub__btn"
              aria-current={e.id === atual ? 'step' : undefined}
              disabled={e.bloqueada}
              onClick={() => onSelecionar(e.id)}
            >
              <IconeEtapa estado={e.estado} numero={e.id} />
              {e.rotulo}
              <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                {`, ${textoEstado(e.estado)}`}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

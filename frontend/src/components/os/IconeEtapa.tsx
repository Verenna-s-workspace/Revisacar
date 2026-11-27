import type { EstadoEtapa } from '../../utils/os_fases';

/** Marcador de uma etapa: check verde quando completa, número quando pendente, tracejado quando opcional vazia. */
export function IconeEtapa({ estado, numero }: { estado: EstadoEtapa; numero: number }) {
  return (
    <span className="osf-ic" data-estado={estado} aria-hidden="true">
      {estado === 'completa' ? (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : numero}
    </span>
  );
}

export const textoEstado = (e: EstadoEtapa) => (e === 'completa' ? 'completa' : e === 'opcional' ? 'opcional' : 'pendente');

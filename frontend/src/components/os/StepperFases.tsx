import { FASES_OS, type FaseId, type FaseOS } from '../../utils/os_fases';
import './os-fase.css';

interface StepperFasesProps {
  atual: FaseId;
  /** Fases já concluídas (ficam com check). Só estas aceitam clique, e só se `onSelecionar` existir. */
  concluidas?: readonly FaseId[];
  fases?: readonly FaseOS[];
  onSelecionar?: (fase: FaseId) => void;
}

const IcCheck = (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/**
 * Stepper das 6 fases da OS (Entrada → Fechamento). Genérico: a fase atual vem de fora e cada tela de fase
 * só o monta. Fase concluída = check; atual = contorno; futura = cinza. No celular só a fase atual mostra o nome.
 */
export function StepperFases({ atual, concluidas = [], fases = FASES_OS, onSelecionar }: StepperFasesProps) {
  return (
    <nav aria-label="Fases da OS">
      <ol className="osf-fases">
        {fases.map((f, i) => {
          const estado = f.id === atual ? 'atual' : concluidas.includes(f.id) ? 'concluida' : 'futura';
          const clicavel = !!onSelecionar && estado === 'concluida';
          const miolo = (
            <>
              <span className="osf-fase__marca">{estado === 'concluida' ? IcCheck : i + 1}</span>
              <span className="osf-fase__rotulo">{f.rotulo}</span>
            </>
          );
          return [
            <li key={f.id} className="osf-fase" data-estado={estado} aria-current={estado === 'atual' ? 'step' : undefined}>
              {clicavel ? (
                <button type="button" className="osf-fase__btn" onClick={() => onSelecionar?.(f.id)}>{miolo}</button>
              ) : (
                <span className="osf-fase__btn" style={{ cursor: 'default' }}>{miolo}</span>
              )}
            </li>,
            i < fases.length - 1 ? <li key={`${f.id}-sep`} className="osf-fase__sep" aria-hidden="true"><span className="osf-fase__conector" style={{ display: 'block' }} /></li> : null,
          ];
        })}
      </ol>
    </nav>
  );
}

import './Status.css';
import { ROTULO_STATUS_OS, tomDoStatus } from './ordensUtils';

/** Selo do status: sempre ponto + texto (nunca só cor). */
export function StatusOS({ status }: { status: string }) {
  return (
    <span className={`os-status os-status--${tomDoStatus(status)}`}>
      <span className="os-status__dot" aria-hidden="true" />
      {ROTULO_STATUS_OS[status] ?? ROTULO_STATUS_OS.rascunho}
    </span>
  );
}
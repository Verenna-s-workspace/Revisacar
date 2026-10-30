import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { MOBILE_STATUS } from './statusTheme';
import { APPOINTMENT_STATUS_CONFIG, APPOINTMENT_STATUS_ORDER } from '../StatusBadge';
import type { AppointmentStatus } from '../../../../types/agendamento';

interface MobileFiltersSheetProps {
  open: boolean;
  status: AppointmentStatus | 'todos';
  onStatusChange: (s: AppointmentStatus | 'todos') => void;
  onClose: () => void;
}

export function MobileFiltersSheet({ open, status, onStatusChange, onClose }: MobileFiltersSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  // Foco: entra na folha ao abrir e volta ao botão que a abriu ao fechar.
  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  const options: { value: AppointmentStatus | 'todos'; label: string; dot?: string }[] = [
    { value: 'todos', label: 'Todos os status' },
    ...APPOINTMENT_STATUS_ORDER.map(s => ({
      value: s as AppointmentStatus,
      label: APPOINTMENT_STATUS_CONFIG[s].label,
      dot: MOBILE_STATUS[s].stripe,
    })),
  ];

  return (
    <>
      <div className={`agm-sheet-backdrop${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`agm-sheet${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agm-sheet-title"
        aria-hidden={!open}
        tabIndex={-1}
      >
        <div className="agm-sheet__grab" aria-hidden="true" />
        <h2 className="agm-sheet__title" id="agm-sheet-title">Filtrar por status</h2>
        <p className="agm-sheet__hint">A escolha vale para as visões Diária, Semanal e Mensal.</p>
        <div className="agm-sheet__options">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              className={`agm-sheet__opt${status === o.value ? ' is-active' : ''}`}
              style={o.dot ? ({ '--dot': o.dot } as CSSProperties) : undefined}
              aria-pressed={status === o.value}
              onClick={() => onStatusChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="agm-sheet__actions">
          <button type="button" className="agm-btn agm-btn--ghost" onClick={() => onStatusChange('todos')}>Limpar</button>
          <button type="button" className="agm-btn" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </>
  );
}

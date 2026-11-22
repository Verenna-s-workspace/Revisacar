import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalSection } from '../../../components/system';
import type { AgendaFiltros, AgendaPeriodo, AppointmentStatus } from '../../../types/agendamento';
import { APPOINTMENT_STATUS_CONFIG, APPOINTMENT_STATUS_ORDER } from './StatusBadge';
import { CLASSE_STATUS } from './agendamentosDesktopUtils';
import { IcCalendario, IcFiltros } from './icones';
import './agendamentosDesktop.css';

export const FILTROS_PADRAO: AgendaFiltros = { status: 'todos', periodo: 'todos' };

export const PERIODOS: { val: AgendaPeriodo; label: string }[] = [
  { val: 'todos', label: 'Todos' },
  { val: 'hoje', label: 'Hoje' },
  { val: 'semana', label: 'Esta semana' },
  { val: 'mes', label: 'Este mês' },
];

export const contarFiltros = (f: AgendaFiltros) => (f.periodo !== 'todos' ? 1 : 0) + (f.status !== 'todos' ? 1 : 0);

interface AgendamentoFiltrosModalProps {
  filtros: AgendaFiltros;
  onApply: (f: AgendaFiltros) => void;
  onClose: () => void;
}

/** Modal de filtros da Agenda (padrão de modais do sistema): período e status. */
export function AgendamentoFiltrosModal({ filtros, onApply, onClose }: AgendamentoFiltrosModalProps) {
  const [rascunho, setRascunho] = useState<AgendaFiltros>(filtros);

  const aplicar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onApply(rascunho);
    onClose();
  };

  return (
    <Modal size="md" onClose={onClose} onSubmit={aplicar}>
      <ModalHeader icon={IcFiltros} title="Filtros" description="Escolha o período e o status dos agendamentos que quer ver." />

      <ModalBody>
        <div className="ag-modal-secoes">
        <ModalSection title="Data" icon={IcCalendario} description="Mostra só os agendamentos do período escolhido.">
          <div className="ag-opcoes" role="group" aria-label="Período">
            {PERIODOS.map(p => (
              <button
                key={p.val}
                type="button"
                className="ag-opcao"
                aria-pressed={rascunho.periodo === p.val}
                onClick={() => setRascunho(r => ({ ...r, periodo: p.val }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </ModalSection>

        <ModalSection title="Status" description="Em que etapa está cada agendamento.">
          <div className="ag-opcoes" role="group" aria-label="Status">
            <button
              type="button"
              className="ag-opcao"
              aria-pressed={rascunho.status === 'todos'}
              onClick={() => setRascunho(r => ({ ...r, status: 'todos' }))}
            >
              Todos
            </button>
            {APPOINTMENT_STATUS_ORDER.map((s: AppointmentStatus) => (
              <button
                key={s}
                type="button"
                className={`ag-opcao ${CLASSE_STATUS[s]}`}
                aria-pressed={rascunho.status === s}
                onClick={() => setRascunho(r => ({ ...r, status: s }))}
              >
                <span className="ag-opcao__ponto" aria-hidden="true" />
                {APPOINTMENT_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </ModalSection>
        </div>
      </ModalBody>

      <ModalFooter
        hint={
          <Button variant="ghost" size="sm" onClick={() => setRascunho(FILTROS_PADRAO)} disabled={contarFiltros(rascunho) === 0}>
            Limpar filtros
          </Button>
        }
      >
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit">Aplicar filtros</Button>
      </ModalFooter>
    </Modal>
  );
}

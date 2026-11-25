import { MOBILE_STATUS } from './statusTheme';
import { APPOINTMENT_STATUS_CONFIG, APPOINTMENT_STATUS_ORDER } from '../StatusBadge';
import {
  Button, Modal, ModalBody, ModalChoices, ModalFooter, ModalHeader, ModalSection,
} from '../../../../components/system';
import { Icons } from '../../Icons';
import type { AppointmentStatus } from '../../../../types/agendamento';

interface MobileFiltersSheetProps {
  open: boolean;
  status: AppointmentStatus | 'todos';
  onStatusChange: (s: AppointmentStatus | 'todos') => void;
  onClose: () => void;
}

const OPCOES: { value: AppointmentStatus | 'todos'; label: string; dot?: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  ...APPOINTMENT_STATUS_ORDER.map(s => ({
    value: s as AppointmentStatus,
    label: APPOINTMENT_STATUS_CONFIG[s].label,
    dot: MOBILE_STATUS[s].stripe,
  })),
];

/** Filtro de status da Agenda no celular. A escolha vale na hora; "Concluir" só fecha. */
export function MobileFiltersSheet({ open, status, onStatusChange, onClose }: MobileFiltersSheetProps) {
  if (!open) return null;
  return (
    <Modal size="sm" onClose={onClose}>
      <ModalHeader icon={Icons.search} title="Filtrar por status" description="A escolha vale para as visões Diária, Semanal e Mensal." />

      <ModalBody>
        <ModalSection title="Status">
          <ModalChoices label="Status do agendamento" value={status} options={OPCOES} onChange={onStatusChange} />
        </ModalSection>
      </ModalBody>

      <ModalFooter
        hint={<Button variant="ghost" size="sm" onClick={() => onStatusChange('todos')} disabled={status === 'todos'}>Limpar</Button>}
      >
        <Button variant="primary" onClick={onClose}>Concluir</Button>
      </ModalFooter>
    </Modal>
  );
}

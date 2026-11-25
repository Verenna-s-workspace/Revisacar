import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import { APPOINTMENT_STATUS_CONFIG, APPOINTMENT_STATUS_ORDER, APPOINTMENT_STATUS_TOM } from './StatusBadge';
import {
  Button, Modal, ModalBadge, ModalBody, ModalChoices, ModalDetail, ModalDetails, ModalFooter, ModalHeader,
  ModalHighlight, ModalHighlights, ModalSection, ModalValue, useConfirm,
} from '../../../components/system';
import { formatLongDate, formatDateBR, formatTimeRange } from '../../../utils/agenda';
import type { Agendamento, AppointmentStatus } from '../../../types/agendamento';

interface AppointmentModalProps {
  agendamento: Agendamento;
  onClose: () => void;
  /** Abre o ajuste de data, início e duração. */
  onEdit: (ag: Agendamento) => void;
  /** Pedido pendente: define a duração e confirma. */
  onConfirmar: (ag: Agendamento) => void;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}

const OPCOES_STATUS = APPOINTMENT_STATUS_ORDER.map(st => ({ value: st, label: APPOINTMENT_STATUS_CONFIG[st].label }));

export function AppointmentModal({
  agendamento: ag, onClose, onEdit, onConfirmar, onReschedule, onCancel, onStatusChange,
}: AppointmentModalProps) {
  const confirmar = useConfirm();
  const re = ag.reagendamento;

  const handleStatus = (st: AppointmentStatus) => {
    if (st === ag.status) return;
    if (ag.status === 'pendente' && st === 'agendado') { onConfirmar(ag); return; }
    onStatusChange(ag.id, st);
    onClose();
  };

  const handleCancelar = async () => {
    const ok = await confirmar({
      title: 'Cancelar agendamento?',
      description: `O agendamento de ${ag.cliente} em ${formatDateBR(ag.data)} será marcado como cancelado.`,
      confirmLabel: 'Cancelar agendamento',
      cancelLabel: 'Voltar',
      tone: 'danger',
    });
    if (ok) { onCancel(ag.id); onClose(); }
  };

  return (
    <Modal size="lg" onClose={onClose}>
      <ModalHeader
        icon={Icons.cal}
        title="Detalhes do Agendamento"
        description={formatLongDate(ag.data)}
        meta={<ModalBadge tone={APPOINTMENT_STATUS_TOM[ag.status]}>{APPOINTMENT_STATUS_CONFIG[ag.status].label}</ModalBadge>}
      />

      <ModalBody>
        {re && (
          <ModalSection icon={AgendaIcons.sync} title="Agendamento remarcado" tone="attention">
            <ModalDetails>
              <ModalDetail label="Data anterior">
                {formatDateBR(re.dataAnterior)}{re.horaAnterior && ` ${re.horaAnterior}`}
              </ModalDetail>
              <ModalDetail label="Nova data">
                {formatDateBR(re.novaData)}{re.novaHora && ` ${re.novaHora}`}
              </ModalDetail>
              <ModalDetail label="Motivo" wide>{re.motivo}</ModalDetail>
            </ModalDetails>
          </ModalSection>
        )}

        <ModalHighlights>
          <ModalHighlight label="Data" icon={Icons.cal}>
            <ModalValue>{formatDateBR(ag.data)}</ModalValue>
          </ModalHighlight>
          <ModalHighlight label="Horário" icon={Icons.clock}>
            <ModalValue>{formatTimeRange(ag.horaInicio, ag.horaFim)}</ModalValue>
          </ModalHighlight>
        </ModalHighlights>

        <ModalSection icon={Icons.car} title="Cliente e veículo">
          <ModalDetails>
            <ModalDetail label="Cliente">{ag.cliente}</ModalDetail>
            <ModalDetail label="Veículo">{ag.veiculo}</ModalDetail>
            <ModalDetail label="Placa" mono>{ag.placa}</ModalDetail>
            <ModalDetail label="Mecânico">{ag.mecanico}</ModalDetail>
          </ModalDetails>
        </ModalSection>

        <ModalSection icon={Icons.wrench} title="Descrição do serviço">
          <ModalDetails columns={1}>
            <ModalDetail label="Descrição">{ag.descricao || 'Sem descrição registrada.'}</ModalDetail>
          </ModalDetails>
        </ModalSection>

        <ModalSection icon={Icons.orders} title="Status" description="Escolha o novo status do agendamento.">
          <ModalChoices label="Status do agendamento" value={ag.status} options={OPCOES_STATUS} onChange={handleStatus} />
        </ModalSection>
      </ModalBody>

      <ModalFooter
        hint={ag.status !== 'cancelado'
          ? <Button variant="danger" size="sm" icon={AgendaIcons.xCircle} onClick={handleCancelar}>Cancelar agendamento</Button>
          : undefined}
      >
        <Button variant="secondary" icon={AgendaIcons.sync} onClick={() => onReschedule(ag.id)}>Reagendar</Button>
        <Button variant={ag.status === 'pendente' ? 'secondary' : 'primary'} icon={Icons.edit} onClick={() => onEdit(ag)}>Ajustar horário</Button>
        {ag.status === 'pendente' && (
          <Button variant="primary" icon={AgendaIcons.checkCircle} onClick={() => onConfirmar(ag)}>Confirmar pedido</Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

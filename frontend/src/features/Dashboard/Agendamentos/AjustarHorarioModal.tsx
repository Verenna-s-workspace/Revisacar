import { useMemo, useState } from 'react';
import { Input } from '../../../components/inputs/input';
import {
  Button, Modal, ModalBody, ModalFields, ModalFooter, ModalHeader, ModalNotice, ModalSection,
} from '../../../components/system';
import { Icons } from '../Icons';
import { lerHorarioFuncionamento } from '../../../utils/horario_funcionamento';
import {
  toISODate,
  timeToMinutes,
  minutesToTime,
  duracaoEmMinutos,
  acharConflito,
  formatDuracao,
  formatDateBR,
  DEFAULT_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
} from '../../../utils/agenda';
import { DuracaoSelector } from './DuracaoSelector';
import type { Agendamento } from '../../../types/agendamento';

interface AjustarHorarioModalProps {
  agendamento: Agendamento;
  /** 'confirmar': pedido pendente (ex.: vindo do app do cliente) — a oficina define a duração e confirma. */
  modo: 'ajustar' | 'confirmar';
  getOcupados: (data: string, excludeId?: string) => { horaInicio: string; horaFim: string; id: string }[];
  onSave: (changes: Partial<Agendamento>) => Promise<void> | void;
  onClose: () => void;
}

/** Ajuste de data, início e duração de um agendamento existente. Quem define o tempo de
 * trabalho é sempre a oficina; o pedido do cliente só traz o horário de chegada. */
export function AjustarHorarioModal({ agendamento: ag, modo, getOcupados, onSave, onClose }: AjustarHorarioModalProps) {
  const [data, setData] = useState(ag.data);
  const [inicio, setInicio] = useState(ag.horaInicio);
  const [duracao, setDuracao] = useState(() => {
    const d = duracaoEmMinutos(ag.horaInicio, ag.horaFim);
    return d > 0 ? d : DEFAULT_DURATION_MINUTES;
  });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const hoje = toISODate(new Date());
  const { horaAbertura, horaFechamento } = lerHorarioFuncionamento();

  const duracaoOk = duracao >= MIN_DURATION_MINUTES && duracao <= MAX_DURATION_MINUTES;
  const inicioOk = /^\d{2}:\d{2}$/.test(inicio);
  const fim = inicioOk ? minutesToTime(timeToMinutes(inicio) + duracao) : '';

  const ocupados = useMemo(() => getOcupados(data, ag.id), [getOcupados, data, ag.id]);
  const conflito = inicioOk && duracaoOk ? acharConflito(inicio, fim, ocupados) : undefined;
  const foraDoExpediente = inicioOk && duracaoOk
    && (timeToMinutes(inicio) < timeToMinutes(horaAbertura) || timeToMinutes(fim) > timeToMinutes(horaFechamento));
  const dataPassada = !data || data < hoje;

  const erro = !duracaoOk ? 'Informe uma duração válida.'
    : !inicioOk ? 'Informe o horário de início.'
    : foraDoExpediente ? `O serviço precisa caber no expediente (${horaAbertura} – ${horaFechamento}).`
    : conflito ? `Conflita com outro agendamento (${conflito.horaInicio} – ${conflito.horaFim}).`
    : dataPassada && data !== ag.data ? 'Escolha uma data de hoje em diante.'
    : null;

  const handleSalvar = async () => {
    if (erro || salvando) return;
    const changes: Partial<Agendamento> = {};
    if (data !== ag.data) changes.data = data;
    if (inicio !== ag.horaInicio) changes.horaInicio = inicio;
    if (fim !== ag.horaFim) changes.horaFim = fim;
    if (modo === 'confirmar') changes.status = 'agendado';
    setSalvando(true);
    setErroSalvar(null);
    try {
      await onSave(changes);
      onClose();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível salvar o novo horário. Escolha um horário disponível dentro do funcionamento da oficina e tente de novo.');
      setSalvando(false);
    }
  };

  const confirmar = modo === 'confirmar';

  return (
    <Modal size="md" onClose={onClose} closeOnBackdrop={!salvando}>
      <ModalHeader
        icon={Icons.clock}
        title={confirmar ? 'Confirmar pedido' : 'Ajustar horário'}
        description={`${ag.cliente} · ${ag.veiculo}`}
      />

      <ModalBody>
        {confirmar && (
          <ModalNotice tone="info">
            O cliente pediu {formatDateBR(ag.data)} às {ag.horaInicio}. Defina quanto tempo o serviço vai levar
            e confirme — o cliente será avisado.
          </ModalNotice>
        )}

        <ModalSection title="Data e horário">
          <ModalFields>
            <Input name="ajuste_data" type="date" label="Data" min={hoje} value={data} onChangeValue={setData} />
            <Input name="ajuste_inicio" type="time" step={900} label="Início" value={inicio} onChangeValue={setInicio} />
          </ModalFields>
        </ModalSection>

        <ModalSection
          title="Duração do serviço"
          description={inicioOk && duracaoOk ? `Termina às ${fim} (${formatDuracao(duracao)}).` : undefined}
        >
          <DuracaoSelector value={duracao} onChange={setDuracao} />
        </ModalSection>
      </ModalBody>

      <ModalFooter
        notice={(erro || erroSalvar) ? <ModalNotice tone="error" role="alert">{erroSalvar ?? erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={handleSalvar} loading={salvando} disabled={!!erro}>
          {salvando ? 'Salvando…' : confirmar ? 'Confirmar pedido' : 'Salvar horário'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import { Input } from '../../../components/inputs/input';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalBody, ModalChoices, ModalColumns, ModalFields, ModalFooter, ModalHeader, ModalNotice, ModalSection,
} from '../../../components/system';
import './novoAgendamento.css';
import { useHorarioFuncionamento } from '../../../hooks/useHorarioFuncionamento';
import { DuracaoSelector } from './DuracaoSelector';
import {
  getMonthMatrix,
  toISODate,
  addMonths,
  addDays,
  minutesToTime,
  timeToMinutes,
  getTimeSlots,
  acharConflito,
  duracaoEmMinutos,
  formatDuracao,
  DEFAULT_DURATION_MINUTES,
  SLOT_STEP_MINUTES,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MONTHS,
  WEEKDAYS_SHORT,
  formatDateBR,
  parseISODate,
  formatDayMonth,
} from '../../../utils/agenda';
import type { Agendamento, NovoAgendamentoInput } from '../../../types/agendamento';

interface OcupadoSlot { horaInicio: string; horaFim: string; id: string; }

interface NewAppointmentModalProps {
  /**
   * Agendamento sendo REAGENDADO. Quando presente o modal vira "Reagendar":
   * os dados (cliente, veículo, placa, serviço) vêm do agendamento original e
   * só se escolhe a nova data/horário — nada precisa ser digitado de novo.
   */
  reagendando?: Agendamento;
  /** Pre-selected date (e.g. when clicking a day in monthly/weekly view). */
  initialDate?: string;
  /** Slots already taken on the selected date (to show as occupied). */
  getOcupados: (data: string) => OcupadoSlot[];
  onConfirm: (input: NovoAgendamentoInput) => void;
  onClose: () => void;
  /** Nome do cliente pré-selecionado (ex.: agendamento aberto a partir do perfil do cliente). */
  initialCliente?: string;
  /** Veículos conhecidos do cliente pré-selecionado, para escolha rápida sem digitar. */
  initialVeiculos?: { veiculo: string; placa: string }[];
}

export function NewAppointmentModal({ initialDate, getOcupados, onConfirm, onClose, initialCliente, initialVeiculos, reagendando }: NewAppointmentModalProps) {
  const { horaAbertura, horaFechamento } = useHorarioFuncionamento();
  const [step, setStep] = useState<1 | 2>(1);
  const todayISO = toISODate(new Date());
  // Ao reagendar, o calendário abre na data atual do agendamento (ou em hoje,
  // se ela já passou — datas passadas não podem ser escolhidas).
  const dataInicial = reagendando
    ? (reagendando.data >= todayISO ? reagendando.data : todayISO)
    : initialDate;
  const [calDate, setCalDate] = useState(() => {
    if (dataInicial) return parseISODate(dataInicial);
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string>(dataInicial ?? toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  // Duração definida pela oficina; ao reagendar, parte da duração que o agendamento já tem.
  const [duracao, setDuracao] = useState<number>(() => {
    if (reagendando) {
      const d = duracaoEmMinutos(reagendando.horaInicio, reagendando.horaFim);
      if (d > 0) return d;
    }
    return DEFAULT_DURATION_MINUTES;
  });
  const duracaoValida = duracao >= MIN_DURATION_MINUTES && duracao <= MAX_DURATION_MINUTES;
  const slots = useMemo(
    () => (duracaoValida ? getTimeSlots(horaAbertura, horaFechamento, SLOT_STEP_MINUTES, duracao) : []),
    [horaAbertura, horaFechamento, duracao, duracaoValida],
  );
  const fimDoSlot = (slot: string) => minutesToTime(timeToMinutes(slot) + duracao);
  // O horário escolhido deixa de valer se a nova duração não cabe mais (expediente ou conflito).
  const slotEscolhidoValido = !!selectedSlot && slots.includes(selectedSlot);

  const [form, setForm] = useState({
    cliente: reagendando?.cliente ?? initialCliente ?? '',
    veiculo: reagendando?.veiculo ?? initialVeiculos?.[0]?.veiculo ?? '',
    placa: reagendando?.placa ?? initialVeiculos?.[0]?.placa ?? '',
    titulo: reagendando?.titulo ?? '',
    descricao: reagendando?.descricao ?? '',
  });

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const matrix = useMemo(() => getMonthMatrix(year, month), [year, month]);
  // Ao reagendar, o horário que o próprio agendamento ocupa hoje não conta como
  // "ocupado" (senão não dá para remarcar para um horário que se sobrepõe a ele).
  const ocupados = useMemo(
    () => getOcupados(selectedDate).filter(o => !reagendando || o.id !== reagendando.id),
    [getOcupados, selectedDate, reagendando],
  );

  const setField = (k: keyof typeof form) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleContinue = () => {
    if (!selectedDate || !selectedSlot || !slotEscolhidoValido) return;
    setStep(2);
  };

  const handleSubmit = () => {
    if (!selectedDate || !selectedSlot || !slotEscolhidoValido) return;
    onConfirm({
      data: selectedDate,
      horaInicio: selectedSlot,
      horaFim: fimDoSlot(selectedSlot),
      cliente: form.cliente.trim(),
      veiculo: form.veiculo.trim(),
      placa: form.placa.trim().toUpperCase(),
      titulo: form.titulo.trim() || 'Serviço Automotivo',
      descricao: form.descricao.trim(),
    });
    onClose();
  };

  // Placa é opcional: só cliente e veículo travam o botão de confirmar.
  const formValid = form.cliente.trim() && form.veiculo.trim();
  const horarioOk = !!selectedDate && slotEscolhidoValido;

  // Reagendando, não há etapa 2: confirma direto com os dados originais.
  const handleSubmitForm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 2) { if (formValid) handleSubmit(); return; }
    if (reagendando) handleSubmit(); else handleContinue();
  };

  const descricao = reagendando
    ? 'Escolha a nova data e o horário.'
    : step === 1 ? 'Etapa 1 de 2 · Escolha a data e o horário.' : 'Etapa 2 de 2 · Dados do agendamento.';

  return (
    <Modal size="lg" onClose={onClose} onSubmit={handleSubmitForm}>
      <ModalHeader icon={Icons.cal} title={reagendando ? 'Reagendar Agendamento' : 'Novo Agendamento'} description={descricao} />

      <ModalBody>
        {/* ── Etapa 1: data + horário ── */}
        {step === 1 && (
          <>
            {/* Reagendamento: resumo do que será mantido (nada a digitar de novo) */}
            {reagendando && (
              <ModalNotice tone="info">
                <strong>{reagendando.cliente}</strong> · {reagendando.veiculo} · {reagendando.placa}
                {' '}— atual: {formatDateBR(reagendando.data)} às {reagendando.horaInicio}
              </ModalNotice>
            )}

            <ModalColumns
              asideFirst
              aside={
                <ModalSection icon={Icons.cal} title="Data">
                  <div className="na-cal__head">
                    <button type="button" className="na-cal__nav" onClick={() => setCalDate(d => addMonths(d, -1))} aria-label="Mês anterior">
                      {AgendaIcons.chevsL}
                    </button>
                    <span className="na-cal__mes">{MONTHS[month]} {year}</span>
                    <button type="button" className="na-cal__nav" onClick={() => setCalDate(d => addMonths(d, 1))} aria-label="Próximo mês">
                      {AgendaIcons.chevsR}
                    </button>
                  </div>

                  <div>
                    <div className="na-cal__semana" aria-hidden="true">
                      {WEEKDAYS_SHORT.map(d => <div key={d} className="na-cal__dow">{d}</div>)}
                    </div>
                    <div className="na-cal__grade">
                      {matrix.map((week, wi) => (
                        <div key={wi} className="na-cal__semana">
                          {week.map((day, di) => {
                            const iso = toISODate(day);
                            const doMes = day.getMonth() === month;
                            const passado = iso < todayISO;
                            return (
                              <button
                                key={di}
                                type="button"
                                className={`na-dia${iso === todayISO ? ' na-dia--hoje' : ''}`}
                                aria-pressed={iso === selectedDate}
                                aria-label={doMes ? formatDateBR(iso) : undefined}
                                disabled={!doMes || passado}
                                onClick={() => { setSelectedDate(iso); setSelectedSlot(null); }}
                              >
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </ModalSection>
              }
            >
              <ModalSection
                icon={Icons.clock}
                title="Horários disponíveis"
                description={`${selectedDate ? `${formatDayMonth(parseISODate(selectedDate))} · ` : ''}Funcionamento: ${horaAbertura} – ${horaFechamento}`}
              >
                <DuracaoSelector value={duracao} onChange={setDuracao} />
                {slots.length === 0 ? (
                  <p className="na-vazio">Nenhum horário disponível — confira a duração e o horário de funcionamento em Configurações.</p>
                ) : (
                  <div className="na-slots">
                    {slots.map(slot => {
                      const ocupado = !!acharConflito(slot, fimDoSlot(slot), ocupados);
                      return (
                        <button
                          key={slot}
                          type="button"
                          className="na-slot"
                          aria-pressed={selectedSlot === slot}
                          disabled={ocupado}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {slot}
                          {ocupado && <span className="na-slot__tag">ocupado</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ModalSection>
            </ModalColumns>
          </>
        )}

        {/* ── Etapa 2: dados do agendamento ── */}
        {step === 2 && selectedSlot && (
          <>
            <ModalSection
              icon={Icons.cal}
              title="Data e horário"
              aside={<Button variant="ghost" size="sm" onClick={() => setStep(1)}>Alterar</Button>}
            >
              <p className="na-resumo">
                {formatDateBR(selectedDate)} · {selectedSlot} – {fimDoSlot(selectedSlot)} ({formatDuracao(duracao)})
              </p>
            </ModalSection>

            <ModalSection
              icon={Icons.user}
              title="Dados do agendamento"
              description={initialCliente ? `Agendando para ${initialCliente}.` : undefined}
            >
              {initialVeiculos && initialVeiculos.length > 1 && (
                <ModalChoices
                  label="Veículo do cliente"
                  value={initialVeiculos.find(v => form.veiculo === v.veiculo && form.placa === v.placa)?.placa ?? ''}
                  options={initialVeiculos.map(v => ({ value: v.placa, label: `${v.veiculo} · ${v.placa}` }))}
                  onChange={placa => {
                    const v = initialVeiculos.find(x => x.placa === placa);
                    if (v) setForm(prev => ({ ...prev, veiculo: v.veiculo, placa: v.placa }));
                  }}
                />
              )}
              <ModalFields>
                <Input name="ag_cliente" label="Nome do Cliente" required placeholder="Carlos Eduardo Oliveira" value={form.cliente} onChangeValue={setField('cliente')} />
                <Input name="ag_veiculo" label="Veículo" required placeholder="BMW 320i M-Sport" value={form.veiculo} onChangeValue={setField('veiculo')} />
                <Input name="ag_placa" type="placa" label="Placa" placeholder="BRA2E19" value={form.placa} onChangeValue={setField('placa')} />
                <Input name="ag_titulo" label="Título do Serviço" placeholder="Revisão de 40.000km" value={form.titulo} onChangeValue={setField('titulo')} />
              </ModalFields>
              <Textarea
                name="ag_descricao"
                label="Descrição"
                placeholder="Descreva o serviço a ser realizado..."
                value={form.descricao}
                onChangeValue={setField('descricao')}
                rows={3}
              />
            </ModalSection>
          </>
        )}
      </ModalBody>

      <ModalFooter hint={step === 2 ? '* Campos obrigatórios' : undefined}>
        {step === 2
          ? <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
          : <Button variant="ghost" onClick={onClose}>Cancelar</Button>}
        {step === 1 ? (
          <Button type="submit" variant="primary" disabled={!horarioOk}>
            {reagendando ? 'Confirmar Reagendamento' : 'Continuar'}
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={!formValid}>Confirmar Agendamento</Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

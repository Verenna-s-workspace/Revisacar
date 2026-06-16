import { useState, useMemo } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import {
  getMonthMatrix,
  toISODate,
  addMonths,
  addDays,
  TIME_SLOTS,
  minutesToTime,
  timeToMinutes,
  DEFAULT_DURATION_MINUTES,
  MONTHS,
  WEEKDAYS_SHORT,
  formatDateBR,
  parseISODate,
  formatDayMonth,
} from '../../../utils/agenda';
import type { NovoAgendamentoInput } from '../../../types/agendamento';

interface OcupadoSlot { horaInicio: string; horaFim: string; id: string; }

interface NewAppointmentModalProps {
  /** Pre-selected date (e.g. when clicking a day in monthly/weekly view). */
  initialDate?: string;
  /** Slots already taken on the selected date (to show as occupied). */
  getOcupados: (data: string) => OcupadoSlot[];
  onConfirm: (input: NovoAgendamentoInput) => void;
  onClose: () => void;
}

function isSlotOccupied(slot: string, ocupados: OcupadoSlot[]): boolean {
  const slotStart = timeToMinutes(slot);
  const slotEnd = slotStart + DEFAULT_DURATION_MINUTES;
  return ocupados.some(o => {
    const oStart = timeToMinutes(o.horaInicio);
    const oEnd = timeToMinutes(o.horaFim);
    return slotStart < oEnd && slotEnd > oStart;
  });
}

export function NewAppointmentModal({ initialDate, getOcupados, onConfirm, onClose }: NewAppointmentModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [calDate, setCalDate] = useState(() => {
    if (initialDate) return parseISODate(initialDate);
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string>(initialDate ?? toISODate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [form, setForm] = useState({
    cliente: '', veiculo: '', placa: '', titulo: '', descricao: '',
  });

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const matrix = useMemo(() => getMonthMatrix(year, month), [year, month]);
  const ocupados = useMemo(() => getOcupados(selectedDate), [getOcupados, selectedDate]);
  const todayISO = toISODate(new Date());

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleContinue = () => {
    if (!selectedDate || !selectedSlot) return;
    setStep(2);
  };

  const handleSubmit = () => {
    if (!selectedDate || !selectedSlot) return;
    onConfirm({
      data: selectedDate,
      horaInicio: selectedSlot,
      horaFim: minutesToTime(timeToMinutes(selectedSlot) + DEFAULT_DURATION_MINUTES),
      cliente: form.cliente.trim(),
      veiculo: form.veiculo.trim(),
      placa: form.placa.trim().toUpperCase(),
      titulo: form.titulo.trim() || 'Serviço Automotivo',
      descricao: form.descricao.trim(),
    });
    onClose();
  };

  const formValid = form.cliente.trim() && form.veiculo.trim() && form.placa.trim();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: `1px solid ${tokens.color.border}`, background: 'white',
    fontSize: '0.875rem', color: tokens.color.text, outline: 'none',
    fontFamily: tokens.fontSans, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: tokens.color.muted, marginBottom: 5, display: 'block',
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        {/* Header */}
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">Novo Agendamento</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {[1, 2].map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 60, height: 5, borderRadius: 99,
                    background: step >= n ? tokens.color.ferrari : tokens.color.border,
                    transition: 'background 0.25s',
                  }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: step >= n ? tokens.color.ferrari : tokens.color.muted }}>
                    {n === 1 ? 'Data e Horário' : 'Dados do Agendamento'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        {/* ── Step 1: Date + Slot picker ── */}
        {step === 1 && (
          <div className="dashboard-modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Calendar */}
            <div>
              {/* Month nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button
                  onClick={() => setCalDate(d => addMonths(d, -1))}
                  style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
                >
                  {AgendaIcons.chevsL}
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>
                  {MONTHS[month]} {year}
                </span>
                <button
                  onClick={() => setCalDate(d => addMonths(d, 1))}
                  style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
                >
                  {AgendaIcons.chevsR}
                </button>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                {WEEKDAYS_SHORT.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {matrix.map((week, wi) => (
                  <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                    {week.map((day, di) => {
                      const iso = toISODate(day);
                      const isCurrentM = day.getMonth() === month;
                      const isT = iso === todayISO;
                      const isSel = iso === selectedDate;
                      const isPast = iso < todayISO;

                      return (
                        <button
                          key={di}
                          disabled={!isCurrentM || isPast}
                          onClick={() => { setSelectedDate(iso); setSelectedSlot(null); }}
                          style={{
                            width: 34, height: 34, borderRadius: 8, border: 'none',
                            background: isSel ? tokens.color.ferrari : isT ? tokens.color.ferrariMid : 'transparent',
                            color: isSel ? 'white' : isT ? tokens.color.ferrari : !isCurrentM || isPast ? tokens.color.ghost : tokens.color.text,
                            fontWeight: isSel || isT ? 700 : 500,
                            fontSize: '0.82rem',
                            cursor: (!isCurrentM || isPast) ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.12s',
                          }}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Time slots */}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted, marginBottom: 10 }}>
                Horários disponíveis
                {selectedDate && <span style={{ color: tokens.color.text, marginLeft: 6 }}>· {formatDayMonth(parseISODate(selectedDate))}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                {TIME_SLOTS.map(slot => {
                  const occupied = isSlotOccupied(slot, ocupados);
                  const isSel = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      disabled={occupied}
                      onClick={() => !occupied && setSelectedSlot(slot)}
                      style={{
                        padding: '9px 10px', borderRadius: 9, border: `1.5px solid`,
                        borderColor: isSel ? tokens.color.ferrari : occupied ? tokens.color.border : tokens.color.border,
                        background: isSel ? tokens.color.ferrariMid : occupied ? tokens.color.bg : 'white',
                        color: isSel ? tokens.color.ferrari : occupied ? tokens.color.ghost : tokens.color.text,
                        fontWeight: isSel ? 700 : 500,
                        fontSize: '0.82rem', fontFamily: tokens.fontMono,
                        cursor: occupied ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.12s',
                        textDecoration: occupied ? 'line-through' : 'none',
                        opacity: occupied ? 0.55 : 1,
                      }}
                    >
                      {slot}
                      {isSel && <span style={{ display: 'flex', color: tokens.color.ferrari }}>{AgendaIcons.checkCircle}</span>}
                      {occupied && !isSel && <span style={{ fontSize: '0.62rem', fontFamily: tokens.fontSans }}>ocupado</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Client form ── */}
        {step === 2 && (
          <div className="dashboard-modal__body">
            <div style={{ padding: '10px 14px', borderRadius: 10, background: tokens.color.ferrariMid, border: `1px solid ${tokens.color.ferrariGlow}`, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ display: 'flex', color: tokens.color.ferrari }}>{Icons.cal}</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: tokens.color.ferrari }}>
                {formatDateBR(selectedDate)} · {selectedSlot} – {minutesToTime(timeToMinutes(selectedSlot!) + DEFAULT_DURATION_MINUTES)}
              </span>
              <button
                onClick={() => setStep(1)}
                style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 600, color: tokens.color.ferrari, background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                alterar
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
              <div>
                <label style={labelStyle}>Nome do Cliente *</label>
                <input style={inputStyle} placeholder="Carlos Eduardo Oliveira" value={form.cliente} onChange={setField('cliente')} />
              </div>
              <div>
                <label style={labelStyle}>Veículo *</label>
                <input style={inputStyle} placeholder="BMW 320i M-Sport" value={form.veiculo} onChange={setField('veiculo')} />
              </div>
              <div>
                <label style={labelStyle}>Placa *</label>
                <input
                  style={{ ...inputStyle, fontFamily: tokens.fontMono, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                  placeholder="BRA2E19"
                  maxLength={8}
                  value={form.placa}
                  onChange={setField('placa')}
                />
              </div>
              <div>
                <label style={labelStyle}>Título do Serviço</label>
                <input style={inputStyle} placeholder="Revisão de 40.000km" value={form.titulo} onChange={setField('titulo')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Descrição</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
                  placeholder="Descreva o serviço a ser realizado..."
                  value={form.descricao}
                  onChange={setField('descricao')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'white', borderRadius: '0 0 20px 20px' }}>
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
            >
              ← Voltar
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.muted, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
            >
              Cancelar
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={handleContinue}
              disabled={!selectedDate || !selectedSlot}
              style={{
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: (!selectedDate || !selectedSlot) ? tokens.color.border : tokens.color.ferrari,
                color: (!selectedDate || !selectedSlot) ? tokens.color.muted : 'white',
                cursor: (!selectedDate || !selectedSlot) ? 'not-allowed' : 'pointer',
                fontSize: '0.84rem', fontWeight: 700, transition: 'background 0.15s',
              }}
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!formValid}
              style={{
                padding: '9px 22px', borderRadius: 10, border: 'none',
                background: formValid ? tokens.color.ferrari : tokens.color.border,
                color: formValid ? 'white' : tokens.color.muted,
                cursor: formValid ? 'pointer' : 'not-allowed',
                fontSize: '0.84rem', fontWeight: 700, transition: 'background 0.15s',
              }}
            >
              Confirmar Agendamento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

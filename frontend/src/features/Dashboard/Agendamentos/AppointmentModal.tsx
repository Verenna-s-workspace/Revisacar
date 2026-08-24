import { useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import { StatusBadge, APPOINTMENT_STATUS_CONFIG, APPOINTMENT_STATUS_ORDER } from './StatusBadge';
import { formatLongDate, formatDateBR, formatTimeRange } from '../../../utils/agenda';
import type { Agendamento, AppointmentStatus } from '../../../types/agendamento';

interface AppointmentModalProps {
  agendamento: Agendamento;
  onClose: () => void;
  onEdit: (ag: Agendamento) => void;
  onReschedule: (id: string) => void;
  onCancel: (id: string) => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}

export function AppointmentModal({
  agendamento: ag, onClose, onEdit, onReschedule, onCancel, onStatusChange,
}: AppointmentModalProps) {
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const InfoGrid = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 20px' }}>
      {children}
    </div>
  );

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div>
      <div style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: value ? tokens.color.text : tokens.color.ghost }}>
        {value || '—'}
      </div>
    </div>
  );

  return (
    <div
      className="dashboard-modal-backdrop"
      onClick={onClose}
      style={{ zIndex: 1200 }}
    >
      <div
        className="dashboard-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 660 }}
      >
        {/* Header */}
        <div className="dashboard-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: tokens.color.ferrariMid, color: tokens.color.ferrari, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Icons.cal}
            </div>
            <div>
              <div className="dashboard-modal__title">Detalhes do Agendamento</div>
              <div className="dashboard-modal__subtitle">{formatLongDate(ag.data)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge status={ag.status} size="md" />
            <button onClick={onClose} className="dashboard-button--close">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="dashboard-modal__body">
          {/* Reschedule banner */}
          {ag.reagendamento && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: tokens.color.ferrariMid, border: `1px solid ${tokens.color.ferrariGlow}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: tokens.color.ferrari, display: 'flex', marginTop: 2, flexShrink: 0 }}>{AgendaIcons.sync}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: tokens.color.ferrari, marginBottom: 6 }}>Agendamento Remarcado</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ padding: '5px 12px', borderRadius: 8, background: 'white', border: `1px solid ${tokens.color.border}` }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted, marginBottom: 2 }}>Data Anterior</div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.textSecond, textDecoration: 'line-through' }}>
                      {formatDateBR(ag.reagendamento.dataAnterior)}
                      {ag.reagendamento.horaAnterior && ` ${ag.reagendamento.horaAnterior}`}
                    </div>
                  </div>
                  <span style={{ color: tokens.color.ferrari, fontWeight: 700 }}>→</span>
                  <div style={{ padding: '5px 12px', borderRadius: 8, background: 'white', border: `1px solid ${tokens.color.ferrariGlow}` }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.ferrari, marginBottom: 2 }}>Nova Data</div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: tokens.color.ferrari }}>
                      {formatDateBR(ag.reagendamento.novaData)}
                      {ag.reagendamento.novaHora && ` ${ag.reagendamento.novaHora}`}
                    </div>
                  </div>
                </div>
                {ag.reagendamento.motivo && (
                  <div style={{ fontSize: '0.78rem', color: tokens.color.textSecond, marginTop: 8 }}>{ag.reagendamento.motivo}</div>
                )}
              </div>
            </div>
          )}

          {/* Client / Vehicle */}
          <InfoGrid>
            <Field label="Cliente" value={ag.cliente} />
            <Field label="Veículo" value={ag.veiculo} />
            <Field label="Placa" value={ag.placa} />
            <Field label="Data" value={formatDateBR(ag.data)} />
            <Field label="Horário" value={formatTimeRange(ag.horaInicio, ag.horaFim)} />
            <Field label="Mecânico" value={ag.mecanico} />
          </InfoGrid>

          {/* Divider */}
          <div style={{ height: 1, background: tokens.color.border }} />

          {/* Description */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted, marginBottom: 8 }}>
              Descrição do Serviço
            </div>
            {ag.descricao ? (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, fontSize: '0.875rem', color: tokens.color.text, lineHeight: 1.6 }}>
                {ag.descricao}
              </div>
            ) : (
              <div style={{ color: tokens.color.ghost, fontSize: '0.85rem' }}>Sem descrição registrada.</div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'white', borderRadius: '0 0 20px 20px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => onEdit(ag)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {Icons.edit} Editar
            </button>
            <button
              onClick={() => onReschedule(ag.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {AgendaIcons.sync} Reagendar
            </button>
            {ag.status !== 'cancelado' && (
              <button
                onClick={() => { if (window.confirm('Cancelar este agendamento?')) { onCancel(ag.id); onClose(); } }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: `1px solid ${tokens.color.critBorder}`, background: tokens.color.critBg, color: tokens.color.crit, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
              >
                {AgendaIcons.xCircle} Cancelar
              </button>
            )}
          </div>

          {/* Status change */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowStatusPicker(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: tokens.color.ferrari, color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
            >
              {Icons.orders} Alterar Status
            </button>
            {showStatusPicker && (
              <div style={{ position: 'absolute', bottom: '110%', right: 0, background: 'white', border: `1px solid ${tokens.color.border}`, borderRadius: 12, boxShadow: tokens.shadow.lg, padding: 8, minWidth: 220, zIndex: 10 }}>
                {APPOINTMENT_STATUS_ORDER.map(st => {
                  const cfg = APPOINTMENT_STATUS_CONFIG[st];
                  const isCurrent = ag.status === st;
                  return (
                    <button
                      key={st}
                      onClick={() => { onStatusChange(ag.id, st); setShowStatusPicker(false); onClose(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 12px', borderRadius: 8, border: 'none',
                        background: isCurrent ? cfg.bg : 'transparent',
                        color: isCurrent ? cfg.color : tokens.color.text,
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: isCurrent ? 700 : 500,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', color: cfg.color }}>{cfg.icon}</span>
                      {cfg.label}
                      {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: cfg.color }}>✓ atual</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

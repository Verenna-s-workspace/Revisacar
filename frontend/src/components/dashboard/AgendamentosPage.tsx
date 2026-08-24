import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';
import { useAgendamentos } from '../../hooks/useAgendamentos';

interface AgendamentoView {
  id: string;
  cliente: string;
  veiculo: string;
  data: string;
  hora: string;
  servico: string;
  status: 'confirmado' | 'pendente' | 'concluido';
}

export function AgendamentosPage({ isMobile }: { isMobile: boolean }) {
  const { agendamentos: rawAgendamentos, loading } = useAgendamentos();
  const [showModal, setShowModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ cliente: '', veiculo: '', data: '', hora: '', servico: 'Troca de Óleo e Filtros', status: 'confirmado' as const });

  // Transform API data to match component view
  const viewAgendamentos = rawAgendamentos.map(appt => ({
    id: appt.id,
    cliente: appt.cliente,
    veiculo: `${appt.veiculo} (${appt.placa})`, // Combine model and plate
    data: appt.data, // Already in YYYY-MM-DD format
    hora: appt.horaInicio, // Use start time for display
    servico: appt.titulo, // Use title as service name
    status: mapStatus(appt.status)
  }));

  // Map API status to component status
  function mapStatus(apiStatus: string): AgendamentoView['status'] {
    switch (apiStatus) {
      case 'agendado':
      case 'em_andamento':
        return 'confirmado';
      case 'aguardando_pagamento':
        return 'pendente';
      case 'concluido':
        return 'concluido';
      case 'cancelado':
        // For cancelled appointments, we could either filter them out or show as concllcuido with different styling
        // For now, let's treat as concluido but this could be improved
        return 'concluido';
      default:
        return 'confirmado'; // Default fallback
    }
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.cliente || !newSchedule.data || !newSchedule.hora) return;
    // Note: In a real implementation, this would call the API via useAgendamentos hook
    // For now, we'll just reset the form since we don't have the create function hooked up yet
    setShowModal(false);
    setNewSchedule({ cliente: '', veiculo: '', data: '', hora: '', servico: 'Troca de Óleo e Filtros', status: 'confirmado' });
    // TODO: Implement actual API call to create appointment using the hook's addAgendamento function
  };

  const getStatusBadge = (status: AgendamentoView['status']) => {
    const configs = {
      confirmado: { label: 'Confirmado', bg: 'var(--color-ok-bg)', color: 'var(--color-ok)', border: 'var(--color-ok-border)' },
      pendente: { label: 'Pendente', bg: 'var(--color-warn-bg)', color: 'var(--color-warn)', border: 'var(--color-warn-border)' },
      concluido: { label: 'Concluído', bg: 'var(--color-na-bg)', color: 'var(--color-na)', border: 'var(--color-na-border)' },
    };
    const c = configs[status];
    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: 10,
        fontSize: '0.68rem',
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`
      }}>
        {c.label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Agenda & Horários</h2>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Gerencie as reservas e agendamentos de serviços automotivos.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'var(--color-ferrari)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            transition: 'var(--transition-fast)',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          {Icons.plus} Novo Agendamento
        </button>
      </div>

      {/* Scheduler Layout */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: tokens.color.muted
        }}>
          Carregando agendamentos...
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.color.border}`, background: tokens.color.surfaceHigh }}>
                  <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Data / Hora</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Cliente</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Veículo</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Serviço Solicitado</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {viewAgendamentos.map(item => {
                  const dateArr = item.data.split('-');
                  const formattedDate = `${dateArr[2]}/${dateArr[1]}/${dateArr[0]}`;
                  return (
                    <tr
                      key={item.id}
                      style={{ borderBottom: `1px solid ${tokens.color.border}` }}
                      className="checklist-item"
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: tokens.color.text }}>{item.hora}</div>
                      <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>{formattedDate}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: 600, color: tokens.color.text }}>
                      {item.cliente}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.84rem', color: tokens.color.textSecond }}>
                      {item.veiculo}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.84rem', color: tokens.color.textSecond }}>
                      {item.servico}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                })}

                {/* Show message when no appointments */}
                {viewAgendamentos.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{
                      textAlign: 'center',
                      padding: '30px 20px',
                      color: tokens.color.muted,
                      fontStyle: 'italic'
                    }}>
                      Nenhum agendamento encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: tokens.color.card,
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            border: `1px solid ${tokens.color.border}`,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Reservar Horário</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>NOME DO CLIENTE *</label>
                <input
                  type="text"
                  required
                  value={newSchedule.cliente}
                  onChange={e => setNewSchedule({ ...newSchedule, cliente: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>VEÍCULO (MODELO E PLACA)</label>
                <input
                  type="text"
                  value={newSchedule.veiculo}
                  onChange={e => setNewSchedule({ ...newSchedule, veiculo: e.target.value })}
                  placeholder="Ex: Civic (PXP-4B22)"
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>DATA DO SERVIÇO *</label>
                  <input
                    type="date"
                    required
                    value={newSchedule.data}
                    onChange={e => setNewSchedule({ ...newSchedule, data: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>HORA *</label>
                  <input
                    type="time"
                    required
                    value={newSchedule.hora}
                    onChange={e => setNewSchedule({ ...newSchedule, hora: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>SERVIÇO PRINCIPAL</label>
                <select
                  value={newSchedule.servico}
                  onChange={e => setNewSchedule({ ...newSchedule, servico: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                >
                  <option>Troca de Óleo e Filtros</option>
                  <option>Revisão de Freios</option>
                  <option>Revisão de Suspensão</option>
                  <option>Alinhamento e Balanceamento</option>
                  <option>Inspeção Completa (Checklist)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.textSecond, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Agendar Horário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

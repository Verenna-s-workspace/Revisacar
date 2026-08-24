import { useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { ClienteIcons } from './icons';
import { StatusBadge } from './StatusBadge';
import { StatusBadge as VehicleStatusBadge } from '../Veiculos/StatusBadge';
import { AppointmentCard } from '../Agendamentos/AppointmentCard';
import { OSRow } from '../OrdensPage';
import { ownerInitial, formatKm } from '../../../utils/veiculos_utils';
import { formatAgendadoBadge, formatDataCurta } from '../../../utils/clientes_utils';
import { formatBRL } from '../../../utils/dashboard';
import { TICKET } from '../../../hooks/useDashboard';
import type { ClienteComDados } from '../../../types/cliente';
import type { VeiculoCadastrado } from '../../../types/veiculo';
import type { Agendamento } from '../../../types/agendamento';
import type { OrdemRow } from '../../../types/dashboard';

interface ClientDetailsModalProps {
  cliente: ClienteComDados;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewVeiculo: (veiculo: VeiculoCadastrado) => void;
  onViewOrdem: (ordem: OrdemRow) => void;
  onNovoAgendamento: (cliente: ClienteComDados) => void;
  onGoToAgendamento: (agendamento: Agendamento) => void;
}

type TabId = 'dados' | 'veiculos' | 'historico' | 'agendamentos';

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function Field({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ padding: '11px 13px', borderRadius: 12, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: tokens.color.muted }}>
        <span style={{ display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.text, fontFamily: mono ? tokens.fontMono : tokens.fontSans, wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function EmptyBlock({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '26px 4px' }}>
      <span style={{ color: tokens.color.ghost, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: '0.8rem', color: tokens.color.muted, lineHeight: 1.5, maxWidth: 320 }}>{text}</span>
    </div>
  );
}

export function ClientDetailsModal({ cliente: c, onClose, onEdit, onDelete, onViewVeiculo, onViewOrdem, onNovoAgendamento, onGoToAgendamento }: ClientDetailsModalProps) {
  const [tab, setTab] = useState<TabId>('dados');

  const TABS: { id: TabId; label: string }[] = [
    { id: 'dados', label: 'Dados Pessoais' },
    { id: 'veiculos', label: `Veículos${c.veiculos.length ? ` (${c.veiculos.length})` : ''}` },
    { id: 'historico', label: 'Histórico' },
    { id: 'agendamentos', label: `Agendamentos${c.agendamentosFuturos.length ? ` (${c.agendamentosFuturos.length})` : ''}` },
  ];

  const concluidas = c.ordens.filter(o => o.status === 'finalizada');
  const gastosEstimados = concluidas.length * TICKET;

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, padding: 0 }}>
        {/* Hero */}
        <div style={{ position: 'relative', minHeight: 190, background: tokens.color.surfaceHigh, borderRadius: '20px 20px 0 0', overflow: 'hidden', flexShrink: 0 }}>
          {c.fotoPrincipal ? (
            <img src={c.fotoPrincipal} alt={c.nome} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 78% 22%, #FF6355 0%, #FF7A6C 34%, #FFB4A8 64%, #FFF3F0 100%)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(20,10,8,0.62) 100%)' }} />

          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.92)', border: 'none', color: tokens.color.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              fontSize: '1.2rem', boxShadow: tokens.shadow.sm,
            }}
          >
            ×
          </button>

          <div style={{ position: 'absolute', left: 24, bottom: 18, right: 80, display: 'flex', alignItems: 'flex-end', gap: 14 }}>
            {!c.fotoPrincipal && (
              <div style={{
                width: 62, height: 62, borderRadius: '50%', flexShrink: 0,
                border: '3px solid rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white' }}>{ownerInitial(c.nome)}</span>
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <StatusBadge
                  status={c.status}
                  size="sm"
                  dynamicLabel={c.status === 'agendado' && c.proximoAgendamento ? `Agendado • ${formatAgendadoBadge(c.proximoAgendamento)}` : undefined}
                />
                <span style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(0,0,0,0.28)', color: 'white', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {c.veiculos.length} veículo{c.veiculos.length === 1 ? '' : 's'}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'white', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.nome}
              </h2>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: tokens.color.surfaceHigh, borderRadius: 12 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 9, border: 'none',
                    background: active ? 'white' : 'transparent',
                    color: active ? tokens.color.ferrari : tokens.color.muted,
                    fontWeight: active ? 700 : 600, fontSize: '0.76rem', cursor: 'pointer',
                    boxShadow: active ? tokens.shadow.xs : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '50vh', overflowY: 'auto' }}>
          {tab === 'dados' && (
            <>
              <div>
                <SectionLabel>Informações de Contato</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <Field icon={ClienteIcons.idCard} label="CPF/CNPJ" value={c.cpfCnpj} mono />
                  <Field icon={ClienteIcons.phone} label="Telefone" value={c.telefone} />
                  <Field icon={ClienteIcons.mail} label="E-mail" value={c.email} />
                  <Field icon={ClienteIcons.pin} label="Endereço" value={c.endereco} />
                  <Field icon={Icons.cal} label="Cliente Desde" value={formatDateLong(c.createdAt)} />
                  <Field icon={Icons.clock} label="Última Visita" value={c.ultimaVisita ? formatDataCurta(c.ultimaVisita) : 'Ainda sem visitas'} />
                </div>
              </div>

              {c.observacoes && (
                <div>
                  <SectionLabel>Observações</SectionLabel>
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}`, fontSize: '0.84rem', color: tokens.color.text, lineHeight: 1.6 }}>
                    {c.observacoes}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'veiculos' && (
            <div>
              <SectionLabel>Veículos Vinculados</SectionLabel>
              {c.veiculos.length === 0 ? (
                <EmptyBlock icon={Icons.car} text="Nenhum veículo vinculado a este cliente ainda. Cadastre um pela tela de Veículos ou editando este cliente." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {c.veiculos.map(v => (
                    <div
                      key={v.id}
                      onClick={() => onViewVeiculo(v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'white', border: `1px solid ${tokens.color.border}`, cursor: 'pointer' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: tokens.color.surfaceHigh, color: tokens.color.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {Icons.car}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: tokens.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.marca} {v.modelo}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: tokens.color.muted, marginTop: 2 }}>
                          {v.placa} · {v.ano} · {formatKm(v.quilometragem)}
                        </div>
                      </div>
                      <VehicleStatusBadge status={v.status} size="sm" />
                      <span style={{ color: tokens.color.ghost, display: 'flex', flexShrink: 0 }}>{Icons.arrow}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'historico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <Field icon={Icons.orders} label="Ordens de Serviço" value={c.ordens.length} />
                <Field icon={ClienteIcons.checkCircle} label="Concluídas" value={concluidas.length} />
                <Field icon={Icons.money} label="Gastos Estimados" value={gastosEstimados > 0 ? formatBRL(gastosEstimados) : '—'} />
              </div>
              <div>
                <SectionLabel>Ordens de Serviço</SectionLabel>
                {c.ordens.length === 0 ? (
                  <EmptyBlock icon={Icons.orders} text="Nenhuma ordem de serviço registrada para este cliente ainda." />
                ) : (
                  <div>
                    {c.ordens.map(o => <OSRow key={o.id} ordem={o} onClick={() => onViewOrdem(o)} />)}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'agendamentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <button
                onClick={() => onNovoAgendamento(c)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px', borderRadius: 12, border: 'none',
                  background: tokens.color.ferrari, color: 'white', fontWeight: 700, fontSize: '0.9rem',
                  cursor: 'pointer', boxShadow: tokens.shadow.ferrari,
                }}
              >
                <span style={{ display: 'flex' }}>{Icons.plus}</span> Novo Agendamento
              </button>

              {c.agendamentosFuturos.length > 0 && (
                <div>
                  <SectionLabel>Próximos Agendamentos</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {c.agendamentosFuturos.map(ag => (
                      <div key={ag.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 2 }}>
                          {formatDataCurta(ag.data)}
                        </span>
                        <AppointmentCard agendamento={ag} onClick={() => onGoToAgendamento(ag)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.agendamentosPassados.length > 0 && (
                <div>
                  <SectionLabel>Histórico de Agendamentos</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.85 }}>
                    {c.agendamentosPassados.map(ag => (
                      <div key={ag.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 2 }}>
                          {formatDataCurta(ag.data)}
                        </span>
                        <AppointmentCard agendamento={ag} onClick={() => onGoToAgendamento(ag)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.agendamentosFuturos.length === 0 && c.agendamentosPassados.length === 0 && (
                <EmptyBlock icon={Icons.cal} text="Nenhum agendamento registrado para este cliente ainda." />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, background: 'white', borderRadius: '0 0 20px 20px' }}>
          <button
            onClick={onDelete}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: `1px solid ${tokens.color.critBorder}`, background: 'transparent', color: tokens.color.crit, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <span style={{ display: 'flex' }}>{Icons.trash}</span> Excluir
          </button>
          <button
            onClick={onEdit}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700 }}
          >
            <span style={{ display: 'flex' }}>{Icons.edit}</span> Editar
          </button>
        </div>
      </div>
    </div>
  );
}

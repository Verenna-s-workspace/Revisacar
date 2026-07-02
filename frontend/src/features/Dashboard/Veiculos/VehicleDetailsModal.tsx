import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { VeiculoIcons, VEHICLE_SILHOUETTES } from './icons';
import { StatusBadge } from './StatusBadge';
import { CATEGORIA_LABEL, formatKm } from '../../../utils/veiculos_utils';
import type { VeiculoCadastrado } from '../../../types/veiculo';

interface VehicleDetailsModalProps {
  veiculo: VeiculoCadastrado;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNewOS?: () => void;
}

function formatDate(iso: string): string {
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

export function VehicleDetailsModal({ veiculo: v, onClose, onEdit, onDelete, onNewOS }: VehicleDetailsModalProps) {
  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, padding: 0 }}>
        {/* Hero */}
        <div style={{ position: 'relative', height: 220, background: tokens.color.surfaceHigh, borderRadius: '20px 20px 0 0', overflow: 'hidden', flexShrink: 0 }}>
          {v.fotoPrincipal ? (
            <img src={v.fotoPrincipal} alt={`${v.marca} ${v.modelo}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', padding: '28px 60px' }}>{VEHICLE_SILHOUETTES[v.categoria]}</div>
          )}

          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(20,10,8,0.55) 100%)' }} />

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

          <div style={{ position: 'absolute', left: 24, bottom: 18, right: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ padding: '3px 9px', borderRadius: 6, background: tokens.color.ferrari, color: 'white', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {CATEGORIA_LABEL[v.categoria]}
              </span>
              <StatusBadge status={v.status} size="sm" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'white', lineHeight: 1.15, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              {v.marca} {v.modelo}
              <span style={{ fontFamily: tokens.fontMono, fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.28)', padding: '2px 10px', borderRadius: 7 }}>
                {v.placa}
              </span>
            </h2>
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 22, maxHeight: '52vh', overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 10 }}>
              Informações Gerais
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <Field icon={Icons.car} label="Marca" value={v.marca} />
              <Field icon={Icons.car} label="Modelo" value={v.modelo} />
              <Field icon={Icons.cal} label="Ano" value={v.ano} />
              <Field icon={VeiculoIcons.palette} label="Cor" value={v.cor || '—'} />
              <Field icon={VeiculoIcons.grid} label="Categoria" value={CATEGORIA_LABEL[v.categoria]} />
              <Field icon={VeiculoIcons.gauge} label="Quilometragem" value={formatKm(v.quilometragem)} />
              <Field icon={VeiculoIcons.fuel} label="Combustível" value={v.combustivel} />
              <Field icon={VeiculoIcons.gearbox} label="Câmbio" value={v.cambio} />
              <Field icon={VeiculoIcons.door} label="Portas" value={`${v.portas} portas`} />
              <Field icon={VeiculoIcons.hash} label="Renavam" value={v.renavam} mono />
              <Field icon={VeiculoIcons.idCard} label="Chassi" value={v.chassi} mono />
              <Field icon={Icons.cal} label="Data de Cadastro" value={formatDate(v.createdAt)} />
            </div>
          </div>

          {v.observacoes && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 8 }}>
                Observações
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}`, fontSize: '0.84rem', color: tokens.color.text, lineHeight: 1.6 }}>
                {v.observacoes}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Proprietário */}
            <div style={{ padding: 16, borderRadius: 16, background: 'white', border: `1px solid ${tokens.color.border}` }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 12 }}>
                Proprietário
              </div>
              {v.proprietario ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                    background: tokens.color.ferrariMid, color: tokens.color.ferrari,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ display: 'flex', transform: 'scale(1.3)' }}>{Icons.user}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text, marginBottom: 3 }}>{v.proprietario.nome}</div>
                    {v.proprietario.docCpfCnpj && <div style={{ fontSize: '0.78rem', color: tokens.color.muted, marginBottom: 2 }}>CPF/CNPJ: {v.proprietario.docCpfCnpj}</div>}
                    {v.proprietario.telefone && <div style={{ fontSize: '0.78rem', color: tokens.color.muted, marginBottom: 2 }}>{v.proprietario.telefone}</div>}
                    {v.proprietario.email && <div style={{ fontSize: '0.78rem', color: tokens.color.muted }}>{v.proprietario.email}</div>}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: tokens.color.ghost }}>
                  <span style={{ display: 'flex' }}>{VeiculoIcons.unlinkUser}</span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Veículo sem proprietário vinculado</span>
                </div>
              )}
            </div>

            {/* Histórico */}
            <div style={{ padding: 16, borderRadius: 16, background: 'white', border: `1px solid ${tokens.color.border}` }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted, marginBottom: 12 }}>
                Histórico de Ordens de Serviço
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '8px 4px' }}>
                <span style={{ color: tokens.color.ghost, display: 'flex' }}>{Icons.orders}</span>
                <span style={{ fontSize: '0.78rem', color: tokens.color.muted, lineHeight: 1.5 }}>
                  Nenhuma OS registrada para este veículo ainda.
                </span>
              </div>
            </div>
          </div>
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
          <button
            onClick={onNewOS}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: 'none', background: tokens.color.ferrari, color: 'white', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, boxShadow: tokens.shadow.ferrari }}
          >
            <span style={{ display: 'flex' }}>{Icons.plus}</span> Nova OS
          </button>
        </div>
      </div>
    </div>
  );
}

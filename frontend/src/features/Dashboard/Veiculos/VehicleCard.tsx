import { tokens } from '../../../constants';
import { VeiculoIcons, VEHICLE_SILHOUETTES } from './icons';
import { Icons } from '../Icons';
import { StatusBadge } from './StatusBadge';
import { CATEGORIA_LABEL, formatKm, ownerInitial } from '../../../utils/veiculos_utils';
import type { VeiculoCadastrado } from '../../../types/veiculo';

interface VehicleCardProps {
  veiculo: VeiculoCadastrado;
  onView: () => void;
  onEdit: () => void;
  onChangeOwner: () => void;
  onUnlinkOwner: () => void;
  onDelete: () => void;
}

function ActionBtn({ title, onClick, danger, children }: { title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        border: `1px solid ${tokens.color.border}`, background: 'white',
        color: danger ? tokens.color.crit : tokens.color.muted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? tokens.color.critBg : tokens.color.surfaceHigh;
        e.currentTarget.style.borderColor = danger ? tokens.color.critBorder : tokens.color.borderMd;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'white';
        e.currentTarget.style.borderColor = tokens.color.border;
      }}
    >
      {children}
    </button>
  );
}

export function VehicleCard({ veiculo: v, onView, onEdit, onChangeOwner, onUnlinkOwner, onDelete }: VehicleCardProps) {
  const hasOwner = !!v.proprietario;

  return (
    <div
      style={{
        background: 'white', borderRadius: 18, border: `1px solid ${tokens.color.border}`,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease', cursor: 'pointer',
      }}
      onClick={onView}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 14px 28px rgba(31,15,12,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Imagem */}
      <div style={{ position: 'relative', height: 168, background: tokens.color.surfaceHigh, flexShrink: 0 }}>
        {v.fotoPrincipal ? (
          <img src={v.fotoPrincipal} alt={`${v.marca} ${v.modelo}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', padding: '18px 22px' }}>
            {VEHICLE_SILHOUETTES[v.categoria]}
          </div>
        )}

        <span
          style={{
            position: 'absolute', top: 10, left: 10,
            padding: '3px 9px', borderRadius: 6,
            background: tokens.color.ferrari, color: 'white',
            fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          {CATEGORIA_LABEL[v.categoria]}
        </span>

        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <StatusBadge status={v.status} size="sm" withIcon={false} style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }} />
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: tokens.color.text, lineHeight: 1.25, minWidth: 0 }}>
            {v.marca} {v.modelo}
          </div>
          <span
            style={{
              fontFamily: tokens.fontMono, fontSize: '0.72rem', fontWeight: 700,
              color: tokens.color.ferrari, background: tokens.color.ferrariMid,
              padding: '2px 7px', borderRadius: 5, letterSpacing: '0.03em', flexShrink: 0,
            }}
          >
            {v.placa}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: tokens.color.muted, flexWrap: 'wrap' }}>
          <span>{v.ano}</span>
          <Dot />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{v.cor}</span>
          <Dot />
          <span>{formatKm(v.quilometragem)}</span>
        </div>

        <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {hasOwner ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: tokens.color.ferrariMid, color: tokens.color.ferrari,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.68rem', fontWeight: 800,
              }}>
                {ownerInitial(v.proprietario!.nome)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.6rem', color: tokens.color.subtle, lineHeight: 1, marginBottom: 2 }}>Proprietário</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                  {v.proprietario!.nome}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: tokens.color.surfaceHigh, color: tokens.color.ghost,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ display: 'flex', transform: 'scale(0.8)' }}>{Icons.user}</span>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.color.ghost }}>Sem Proprietário</div>
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 14px', borderTop: `1px solid ${tokens.color.border}`, background: tokens.color.bg,
        }}
        onClick={e => e.stopPropagation()}
      >
        <ActionBtn title="Visualizar" onClick={onView}>{VeiculoIcons.eye}</ActionBtn>
        <ActionBtn title="Editar" onClick={onEdit}>{Icons.edit}</ActionBtn>
        <ActionBtn title="Alterar Proprietário" onClick={onChangeOwner}>{VeiculoIcons.linkUser}</ActionBtn>
        <ActionBtn title="Desvincular Proprietário" onClick={onUnlinkOwner}>
          <span style={{ opacity: hasOwner ? 1 : 0.35 }}>{VeiculoIcons.unlinkUser}</span>
        </ActionBtn>
        <ActionBtn title="Excluir" onClick={onDelete} danger>{Icons.trash}</ActionBtn>
      </div>
    </div>
  );
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: '50%', background: tokens.color.ghost, flexShrink: 0 }} />;
}

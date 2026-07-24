import type { ReactNode } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Card } from '../Primitives';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';

interface ActionBtnProps {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}

function ActionBtn({ title, onClick, danger, children }: ActionBtnProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="dashboard-card__icon-button"
      style={danger ? { color: tokens.color.crit } : undefined}
    >
      {children}
    </button>
  );
}

interface KitCardProps {
  kit: EstoqueKit;
  itensPorId: Map<string, EstoqueItem>;
  disponibilidade: number;
  aplicando?: boolean;
  erro?: string | null;
  onAplicar: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function KitCard({ kit, itensPorId, disponibilidade, aplicando, erro, onAplicar, onEdit, onDelete }: KitCardProps) {
  const indisponivel = disponibilidade <= 0;

  const receitaTexto = kit.itens
    .map(r => `${r.quantidade}x ${itensPorId.get(r.itemId)?.nome ?? 'item removido'}`)
    .join(' · ');

  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, opacity: indisponivel ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
            background: tokens.color.ferrariMid, color: tokens.color.ferrari,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {kit.fotoDataUrl ? <img src={kit.fotoDataUrl} alt={kit.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : Icons.box}
        </div>
        <div style={{ minWidth: 0 }}>
          {indisponivel ? (
            <span style={{ padding: '3px 8px', background: tokens.color.critBg, color: tokens.color.crit, borderRadius: 6, fontSize: '0.68rem', fontWeight: 700 }}>
              Indisponível
            </span>
          ) : (
            <span style={{ padding: '3px 8px', background: tokens.color.okBg, color: tokens.color.ok, borderRadius: 6, fontSize: '0.68rem', fontWeight: 700 }}>
              Dá pra montar {disponibilidade}
            </span>
          )}
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: tokens.color.text, margin: '6px 0 0' }}>{kit.nome}</h3>
        </div>
      </div>

      {kit.descricao && <p style={{ fontSize: '0.82rem', color: tokens.color.textSecond, lineHeight: 1.4, margin: 0 }}>{kit.descricao}</p>}

      <div style={{ fontSize: '0.78rem', color: tokens.color.muted, lineHeight: 1.5 }}>{receitaTexto}</div>

      {erro && (
        <div style={{ fontSize: '0.76rem', color: tokens.color.crit, background: tokens.color.critBg, borderRadius: 8, padding: '8px 10px' }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `1px solid ${tokens.color.border}`, paddingTop: 10, marginTop: 2 }}>
        <button
          onClick={onAplicar}
          disabled={indisponivel || aplicando}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: indisponivel ? tokens.color.surfaceHigh : tokens.color.ferrari,
            color: indisponivel ? tokens.color.ghost : 'white',
            fontSize: '0.8rem', fontWeight: 700, cursor: indisponivel || aplicando ? 'not-allowed' : 'pointer',
          }}
        >
          {aplicando ? 'Aplicando...' : 'Aplicar Kit'}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <ActionBtn title="Editar" onClick={onEdit}>{Icons.edit}</ActionBtn>
          <ActionBtn title="Excluir" onClick={onDelete} danger>{Icons.trash}</ActionBtn>
        </div>
      </div>
    </Card>
  );
}

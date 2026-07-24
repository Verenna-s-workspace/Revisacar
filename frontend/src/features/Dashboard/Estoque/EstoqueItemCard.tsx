import type { ReactNode } from 'react';
import { tokens } from '../../../constants';
import { Icons, CATEGORIA_ICON } from '../Icons';
import { Card } from '../Primitives';
import { formatBRL } from '../../../utils/dashboard';
import { itemEstaBaixo } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';

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

interface EstoqueItemCardProps {
  item: EstoqueItem;
  onEdit: () => void;
  onDelete: () => void;
}

export function EstoqueItemCard({ item, onEdit, onDelete }: EstoqueItemCardProps) {
  const emQuarentena = item.status === 'quarentena';
  const baixo = itemEstaBaixo(item);

  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          borderRadius: 10,
          overflow: 'hidden',
          background: tokens.color.ferrariMid,
          color: tokens.color.ferrari,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {item.fotoDataUrl ? (
          <img src={item.fotoDataUrl} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ display: 'flex', transform: 'scale(1.8)' }}>{CATEGORIA_ICON[item.categoria] ?? Icons.box}</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '2px 7px', background: tokens.color.surfaceHigh, color: tokens.color.textSecond,
            borderRadius: 6, fontSize: '0.64rem', fontWeight: 700,
          }}
        >
          {item.categoria}
        </span>
        {emQuarentena && (
          <span style={{ padding: '2px 7px', background: tokens.color.warnBg, color: tokens.color.warn, borderRadius: 6, fontSize: '0.64rem', fontWeight: 700 }}>
            Quarentena
          </span>
        )}
        {!emQuarentena && baixo && (
          <span style={{ padding: '2px 7px', background: tokens.color.warnBg, color: tokens.color.warn, borderRadius: 6, fontSize: '0.64rem', fontWeight: 700 }}>
            Estoque baixo
          </span>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            fontSize: '0.88rem', fontWeight: 800, color: tokens.color.text, margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
          title={item.nome}
        >
          {item.nome}
        </h3>
        <div style={{ fontSize: '0.7rem', color: tokens.color.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.localizacao}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '1.02rem', fontWeight: 800, color: tokens.color.ferrari }}>{formatBRL(item.preco)}</span>
        <span
          style={{
            fontSize: '0.74rem', fontWeight: 700, whiteSpace: 'nowrap',
            color: emQuarentena || baixo ? tokens.color.warn : tokens.color.muted,
          }}
        >
          {item.quantidade} un.
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, borderTop: `1px solid ${tokens.color.border}`, paddingTop: 8, marginTop: 2 }}>
        <ActionBtn title="Editar" onClick={onEdit}>{Icons.edit}</ActionBtn>
        <ActionBtn title="Excluir" onClick={onDelete} danger>{Icons.trash}</ActionBtn>
      </div>
    </Card>
  );
}

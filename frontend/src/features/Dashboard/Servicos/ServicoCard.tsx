import type { ReactNode } from 'react';
import { tokens } from '../../../constants';
import { Icons, SVC_ICON } from '../Icons';
import { Card } from '../Primitives';
import { formatPreco } from '../../../utils/servicos_utils';
import type { ServicoItem } from '../../../types/servico';

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

interface ServicoCardProps {
  servico: ServicoItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAtivo: () => void;
}

export function ServicoCard({ servico, onEdit, onDelete, onToggleAtivo }: ServicoCardProps) {
  const inativo = !servico.ativo;

  return (
    <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, opacity: inativo ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: tokens.color.ferrariMid, color: tokens.color.ferrari,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {SVC_ICON[servico.nome] ?? Icons.wrench}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '3px 8px', background: tokens.color.surfaceHigh, color: tokens.color.textSecond,
                  borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                }}
              >
                {servico.categoria}
              </span>
              {inativo && (
                <span
                  style={{
                    padding: '3px 8px', background: tokens.color.critBg, color: tokens.color.crit,
                    borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                  }}
                >
                  Inativo
                </span>
              )}
            </div>
            <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: tokens.color.text, margin: '8px 0 0' }}>
              {servico.nome}
            </h3>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: tokens.color.ferrari, whiteSpace: 'nowrap' }}>
            R$ {formatPreco(servico.preco)}
          </div>
          <div style={{ fontSize: '0.74rem', color: tokens.color.muted, marginTop: 2, whiteSpace: 'nowrap' }}>
            {servico.duracao}
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: tokens.color.textSecond, lineHeight: 1.4, margin: 0 }}>
        {servico.descricao}
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, borderTop: `1px solid ${tokens.color.border}`, paddingTop: 10, marginTop: 2 }}>
        <ActionBtn title={inativo ? 'Ativar serviço' : 'Desativar serviço'} onClick={onToggleAtivo}>
          {Icons.check}
        </ActionBtn>
        <ActionBtn title="Editar" onClick={onEdit}>{Icons.edit}</ActionBtn>
        <ActionBtn title="Excluir" onClick={onDelete} danger>{Icons.trash}</ActionBtn>
      </div>
    </Card>
  );
}

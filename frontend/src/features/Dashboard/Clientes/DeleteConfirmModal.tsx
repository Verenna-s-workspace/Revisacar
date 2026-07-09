import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import type { ClienteComDados } from '../../../types/cliente';

interface DeleteConfirmModalProps {
  cliente: ClienteComDados;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({ cliente, onConfirm, onClose }: DeleteConfirmModalProps) {
  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1300 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', padding: '32px 28px 24px' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', margin: '0 auto 18px',
          background: tokens.color.critBg, color: tokens.color.crit,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ display: 'flex', transform: 'scale(1.5)' }}>{Icons.alert}</span>
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, marginBottom: 8 }}>
          Confirmar Exclusão
        </div>
        <p style={{ fontSize: '0.86rem', color: tokens.color.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Tem certeza que deseja excluir o cliente{' '}
          <strong style={{ color: tokens.color.text }}>{cliente.nome}</strong>?
          {' '}Esta ação não pode ser desfeita.
        </p>
        {cliente.veiculos.length > 0 && (
          <p style={{ fontSize: '0.78rem', color: tokens.color.muted, lineHeight: 1.5, marginBottom: 26, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 10, padding: '9px 12px' }}>
            Os {cliente.veiculos.length} veículo{cliente.veiculos.length > 1 ? 's' : ''} vinculados continuam cadastrados na tela de Veículos — apenas o registro de cliente é removido.
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: cliente.veiculos.length > 0 ? 0 : 16 }}>
          <button
            onClick={onClose}
            style={{ padding: '11px 16px', borderRadius: 11, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.text, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{ padding: '11px 16px', borderRadius: 11, border: 'none', background: tokens.color.crit, color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
          >
            Sim, Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

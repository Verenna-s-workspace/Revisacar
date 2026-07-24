import { tokens } from '../../../constants';
import { Icons } from '../Icons';

interface ConfirmDeleteModalProps {
  /** Nome do que está sendo excluído, mostrado em destaque na pergunta. */
  nome: string;
  /** Ex.: "produto", "kit" — encaixa na frase "excluir o <entidadeLabel> X?". */
  entidadeLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDeleteModal({ nome, entidadeLabel, onConfirm, onClose }: ConfirmDeleteModalProps) {
  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1300 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center', padding: '32px 28px 24px' }}>
        <div
          style={{
            width: 60, height: 60, borderRadius: '50%', margin: '0 auto 18px',
            background: tokens.color.critBg, color: tokens.color.crit,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ display: 'flex', transform: 'scale(1.5)' }}>{Icons.alert}</span>
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, marginBottom: 8 }}>
          Confirmar Exclusão
        </div>
        <p style={{ fontSize: '0.86rem', color: tokens.color.muted, lineHeight: 1.6, marginBottom: 26 }}>
          Tem certeza que deseja excluir o {entidadeLabel}{' '}
          <strong style={{ color: tokens.color.text }}>{nome}</strong>?
          {' '}Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

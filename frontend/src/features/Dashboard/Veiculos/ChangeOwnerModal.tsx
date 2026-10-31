import { useState } from 'react';
import { tokens } from '../../../constants';
import { OwnerPicker } from './OwnerPicker';
import type { Cliente } from '../../../types/cliente';
import type { VeiculoCadastrado, VeiculoProprietario } from '../../../types/veiculo';

interface ChangeOwnerModalProps {
  veiculo: VeiculoCadastrado;
  /** Clientes da carteira — o proprietário é escolhido entre eles (ou cadastrado na hora). */
  clientes: Cliente[];
  onSave: (proprietario: VeiculoProprietario | null) => void;
  onClose: () => void;
}

export function ChangeOwnerModal({ veiculo, clientes, onSave, onClose }: ChangeOwnerModalProps) {
  const [proprietario, setProprietario] = useState<VeiculoProprietario | null>(veiculo.proprietario ?? null);
  const valido = !!proprietario?.nome.trim();

  const handleSave = () => {
    if (!proprietario || !valido) return;
    onSave({
      clienteId: proprietario.clienteId,
      nome: proprietario.nome.trim(),
      docCpfCnpj: proprietario.docCpfCnpj?.trim() || undefined,
      telefone: proprietario.telefone?.trim() || undefined,
      email: proprietario.email?.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1250 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{veiculo.proprietario ? 'Alterar Proprietário' : 'Vincular Proprietário'}</div>
            <div className="dashboard-modal__subtitle">{veiculo.marca} {veiculo.modelo} · {veiculo.placa}</div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        <div className="dashboard-modal__body">
          <OwnerPicker name="proprietario" clientes={clientes} value={proprietario} onChange={setProprietario} autoFocus />
        </div>

        <div style={{ padding: '14px 24px', borderTop: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.muted, cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!valido}
            style={{
              padding: '9px 22px', borderRadius: 10, border: 'none',
              background: !valido ? tokens.color.border : tokens.color.ferrari,
              color: !valido ? tokens.color.muted : 'white',
              cursor: !valido ? 'not-allowed' : 'pointer',
              fontSize: '0.84rem', fontWeight: 700,
            }}
          >
            Salvar Proprietário
          </button>
        </div>
      </div>
    </div>
  );
}

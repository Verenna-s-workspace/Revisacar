import { useState } from 'react';
import { tokens } from '../../../constants';
import { VeiculoIcons } from './icons';
import { Input } from '../../../components/inputs/input';
import type { VeiculoCadastrado, VeiculoProprietario } from '../../../types/veiculo';

interface ChangeOwnerModalProps {
  veiculo: VeiculoCadastrado;
  onSave: (proprietario: VeiculoProprietario | null) => void;
  onClose: () => void;
}

export function ChangeOwnerModal({ veiculo, onSave, onClose }: ChangeOwnerModalProps) {
  const [nome, setNome] = useState(veiculo.proprietario?.nome ?? '');
  const [doc, setDoc] = useState(veiculo.proprietario?.docCpfCnpj ?? '');
  const [tel, setTel] = useState(veiculo.proprietario?.telefone ?? '');
  const [email, setEmail] = useState(veiculo.proprietario?.email ?? '');

  const handleSave = () => {
    if (!nome.trim()) return;
    onSave({ nome: nome.trim(), docCpfCnpj: doc.trim() || undefined, telefone: tel.trim() || undefined, email: email.trim() || undefined });
    onClose();
  };

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1250 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{veiculo.proprietario ? 'Alterar Proprietário' : 'Vincular Proprietário'}</div>
            <div className="dashboard-modal__subtitle">{veiculo.marca} {veiculo.modelo} · {veiculo.placa}</div>
          </div>
          <button onClick={onClose} className="dashboard-button--close">×</button>
        </div>

        <div className="dashboard-modal__body">
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', padding: '9px 12px',
            background: tokens.color.ferrariMid, borderRadius: 9, fontSize: '0.74rem', color: tokens.color.ferrari, fontWeight: 600,
          }}>
            <span style={{ display: 'flex' }}>{VeiculoIcons.linkUser}</span>
            🔜 Em breve: selecionar um cliente já cadastrado na sua carteira.
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <Input name="proprietario_nome" label="Nome do Proprietário" required placeholder="Nome completo" value={nome} onChangeValue={setNome} autoFocus />
            <div className="dashboard-form-grid-2col" style={{ gap: 14 }}>
              <Input name="proprietario_doc" type="cpf_cnpj" label="CPF/CNPJ" placeholder="000.000.000-00" value={doc} onChangeValue={setDoc} />
              <Input name="proprietario_tel" type="phone" label="Telefone" placeholder="(11) 99999-9999" value={tel} onChangeValue={setTel} />
            </div>
            <Input name="proprietario_email" type="email" label="E-mail" placeholder="email@exemplo.com" value={email} onChangeValue={setEmail} />
          </div>
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
            disabled={!nome.trim()}
            style={{
              padding: '9px 22px', borderRadius: 10, border: 'none',
              background: !nome.trim() ? tokens.color.border : tokens.color.ferrari,
              color: !nome.trim() ? tokens.color.muted : 'white',
              cursor: !nome.trim() ? 'not-allowed' : 'pointer',
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

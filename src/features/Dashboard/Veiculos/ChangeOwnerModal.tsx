import { useState } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalSection } from '../../../components/system';
import { OwnerPicker } from './OwnerPicker';
import { IcUsuario } from './icones';
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

  // Sem <form>: o campo de busca do OwnerPicker usa Enter para escolher, não para salvar.
  return (
    <Modal size="md" onClose={onClose}>
      <ModalHeader
        icon={IcUsuario}
        title={veiculo.proprietario ? 'Alterar proprietário' : 'Vincular proprietário'}
        description={`${veiculo.marca} ${veiculo.modelo} · ${veiculo.placa}`}
      />

      <ModalBody>
        <ModalSection title="Proprietário" description="Escolha um cliente da carteira ou cadastre um novo.">
          <OwnerPicker name="proprietario" clientes={clientes} value={proprietario} onChange={setProprietario} autoFocus />
        </ModalSection>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={handleSave} disabled={!valido}>Salvar proprietário</Button>
      </ModalFooter>
    </Modal>
  );
}

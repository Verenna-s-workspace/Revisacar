import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '../../../components/inputs/input';
import {
  Button, Modal, ModalBody, ModalFooter, ModalHeader, ModalHighlight, ModalHighlights, ModalNotice, ModalSection, ModalValue,
} from '../../../components/system';
import { Icons } from '../Icons';
import type { EstoqueItem } from '../../../types/estoque';

interface RegistrarCompraModalProps {
  item: EstoqueItem;
  salvando: boolean;
  erro: string | null;
  onConfirmar: (quantidadeComprada: number, novoPreco?: number) => Promise<void>;
  onClose: () => void;
}

/** Dá entrada no estoque de um item com alerta de estoque baixo. Usado pelo Alertas desktop e mobile. */
export function RegistrarCompraModal({ item, salvando, erro, onConfirmar, onClose }: RegistrarCompraModalProps) {
  const sugerida = Math.max(1, item.minimo - item.quantidade);
  const [quantidade, setQuantidade] = useState(String(sugerida));
  const [preco, setPreco] = useState(item.preco ? String(item.preco) : '');

  const qtdNum = Number(quantidade);
  const precoNum = Number(preco);
  const valido = Number.isFinite(qtdNum) && qtdNum > 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valido || salvando) return;
    void onConfirmar(qtdNum, Number.isFinite(precoNum) && precoNum > 0 ? precoNum : undefined);
  };

  return (
    <Modal size="sm" onClose={onClose} onSubmit={handleSubmit} closeOnBackdrop={!salvando}>
      <ModalHeader icon={Icons.box} title="Registrar compra" description={item.nome} />

      <ModalBody>
        <ModalHighlights>
          <ModalHighlight label="Estoque atual">
            <ModalValue>{item.quantidade} un.</ModalValue>
          </ModalHighlight>
          <ModalHighlight label="Após a entrada">
            <ModalValue>{item.quantidade + (valido ? qtdNum : 0)} un.</ModalValue>
          </ModalHighlight>
        </ModalHighlights>

        <ModalSection title="Compra" description={`Estoque mínimo deste item: ${item.minimo} un.`}>
          <Input
            name="compra_quantidade"
            type="number"
            label="Quantidade comprada"
            required
            autoFocus
            min={1}
            value={quantidade}
            onChangeValue={setQuantidade}
          />
          <Input
            name="compra_preco"
            type="currency"
            label="Preço unitário (opcional)"
            value={preco}
            onChangeValue={setPreco}
            placeholder="R$ 0,00"
          />
        </ModalSection>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={salvando} disabled={!valido}>
          {salvando ? 'Salvando…' : 'Confirmar entrada'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

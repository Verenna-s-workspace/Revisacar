import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './Modal';

export interface ActionSheetAction {
  label: string;
  /** Ícone à esquerda (18px). */
  icon?: ReactNode;
  /** danger = ação destrutiva (ex.: Excluir). Fica por último na lista. */
  tone?: 'default' | 'danger';
  /** Quem chama decide se fecha o sheet (normalmente: limpar o item selecionado e só então agir). */
  onSelect: () => void;
}

export interface ActionSheetProps {
  /** O que está sendo acionado (nome do cliente, do veículo…). */
  title: string;
  /** Apoio abaixo do título (placa · proprietário, telefone…). */
  description?: ReactNode;
  actions: ActionSheetAction[];
  onClose: () => void;
}

/**
 * Sheet de ações de um item (o “⋯” das listas no celular). É o `Modal` do sistema em tamanho `sm`:
 * mesmo cabeçalho/rodapé do modal de produto, sobe da base da tela em ≤640px, Esc e clique fora fecham.
 * O “Cancelar” fica embaixo, ao alcance do polegar (uso com uma mão).
 * Vai para o <body> (portal) para não herdar transform/overflow de quem o abriu.
 */
export function ActionSheet({ title, description, actions, onClose }: ActionSheetProps) {
  return createPortal(
    <Modal size="sm" onClose={onClose}>
      <ModalHeader title={title} description={description} />
      <ModalBody>
        <ul className="sys-modal__action-list">
          {actions.map(a => (
            <li key={a.label}>
              <button
                type="button"
                className={`sys-modal__action${a.tone === 'danger' ? ' sys-modal__action--danger' : ''}`}
                onClick={a.onSelect}
              >
                {a.icon && <span className="sys-modal__action-icon" aria-hidden="true">{a.icon}</span>}
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      </ModalFooter>
    </Modal>,
    document.body,
  );
}

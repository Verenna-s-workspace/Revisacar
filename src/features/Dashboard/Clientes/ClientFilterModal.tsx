import { useState } from 'react';
import type { FormEvent } from 'react';
import { emptyFiltros, filtrosAtivos } from '../../../utils/clientes_utils';
import { CLIENTE_STATUS_ORDER, CLIENTE_STATUS_CONFIG } from './StatusBadge';
import {
  Button, Modal, ModalBody, ModalChoices, ModalFooter, ModalHeader, ModalSection, ModalSwitch,
} from '../../../components/system';
import type { ClienteFiltros, ClienteStatusFiltro } from '../../../types/cliente';
import { IcFiltros } from './icones';

interface ClientFilterModalProps {
  filtros: ClienteFiltros;
  onApply: (f: ClienteFiltros) => void;
  onClose: () => void;
}

const STATUS_OPTS: { value: ClienteStatusFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...CLIENTE_STATUS_ORDER.map(s => ({ value: s, label: CLIENTE_STATUS_CONFIG[s].label })),
];

export function ClientFilterModal({ filtros, onApply, onClose }: ClientFilterModalProps) {
  const [f, setF] = useState<ClienteFiltros>(filtros);

  const set = <K extends keyof ClienteFiltros>(key: K, value: ClienteFiltros[K]) =>
    setF(prev => ({ ...prev, [key]: value }));

  const handleApply = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onApply(f);
    onClose();
  };

  return (
    <Modal size="md" onClose={onClose} onSubmit={handleApply}>
      <ModalHeader icon={IcFiltros} title="Filtros de pesquisa" description="Refine a listagem de clientes." />

      <ModalBody>
        <ModalSection title="Status">
          <ModalChoices label="Status do cliente" value={f.status} options={STATUS_OPTS} onChange={v => set('status', v)} />
        </ModalSection>

        <ModalSection title="Cadastro">
          <ModalSwitch
            label="Somente clientes sem veículos"
            description="Mostra quem ainda não tem veículo cadastrado."
            checked={f.semVeiculos}
            onChange={v => set('semVeiculos', v)}
          />
        </ModalSection>
      </ModalBody>

      <ModalFooter
        hint={
          <Button variant="ghost" size="sm" onClick={() => setF(emptyFiltros())} disabled={!filtrosAtivos(f)}>
            Limpar filtros
          </Button>
        }
      >
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" type="submit">Aplicar filtros</Button>
      </ModalFooter>
    </Modal>
  );
}

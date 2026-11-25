import { useState } from 'react';
import type { FormEvent } from 'react';
import { CATEGORIA_OPTIONS, MARCAS_SUGERIDAS, emptyFiltros, filtrosAtivos } from '../../../utils/veiculos_utils';
import { VEICULO_STATUS_ORDER, VEICULO_STATUS_CONFIG } from './StatusBadge';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import {
  Button, Modal, ModalBody, ModalChoices, ModalFields, ModalFooter, ModalHeader, ModalSection,
} from '../../../components/system';
import type { VeiculoFiltros, VeiculoStatus, VeiculoVinculo, VeiculoCategoria } from '../../../types/veiculo';
import { IcFiltros } from './icones';

interface VehicleFilterModalProps {
  filtros: VeiculoFiltros;
  onApply: (f: VeiculoFiltros) => void;
  onClose: () => void;
}

const VINCULO_OPTS: { value: VeiculoVinculo; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'com',   label: 'Com proprietário' },
  { value: 'sem',   label: 'Sem proprietário' },
];

const CATEGORIA_FILTER_OPTS: { value: VeiculoCategoria | 'todas'; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  ...CATEGORIA_OPTIONS.map(c => ({ value: c.value, label: c.label })),
];

const STATUS_SELECT_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  ...VEICULO_STATUS_ORDER.map(s => ({ value: s, label: VEICULO_STATUS_CONFIG[s].label })),
];

export function VehicleFilterModal({ filtros, onApply, onClose }: VehicleFilterModalProps) {
  const [f, setF] = useState<VeiculoFiltros>(filtros);

  const set = <K extends keyof VeiculoFiltros>(key: K, value: VeiculoFiltros[K]) =>
    setF(prev => ({ ...prev, [key]: value }));

  const handleApply = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onApply(f);
    onClose();
  };

  return (
    <Modal size="lg" onClose={onClose} onSubmit={handleApply}>
      <ModalHeader icon={IcFiltros} title="Filtros de pesquisa" description="Refine a listagem de veículos da frota." />

      <ModalBody>
        <ModalSection title="Veículo">
          <ModalFields>
            <Select name="marca_filtro" label="Marca" value={f.marca} placeholder="Todas as marcas" options={MARCAS_SUGERIDAS} onChangeValue={v => set('marca', v)} />
            <Input name="modelo_filtro" label="Modelo" placeholder="Ex: Corolla, HB20..." value={f.modelo} onChangeValue={v => set('modelo', v)} />
            <Input name="ano_de" label="Ano inicial" placeholder="De" type="number" value={f.anoDe} onChangeValue={v => set('anoDe', v)} />
            <Input name="ano_ate" label="Ano final" placeholder="Até" type="number" value={f.anoAte} onChangeValue={v => set('anoAte', v)} />
            <Input name="cor_filtro" label="Cor" placeholder="Ex: Branco, Prata..." value={f.cor} onChangeValue={v => set('cor', v)} />
            <Select
              name="status_filtro"
              label="Status do veículo"
              value={f.status}
              options={STATUS_SELECT_OPTIONS}
              onChangeValue={v => set('status', v as VeiculoStatus | 'todos')}
            />
          </ModalFields>
          <ModalChoices label="Categoria" value={f.categoria} options={CATEGORIA_FILTER_OPTS} onChange={v => set('categoria', v)} />
        </ModalSection>

        <ModalSection title="Proprietário">
          <ModalChoices label="Vínculo" value={f.vinculo} options={VINCULO_OPTS} onChange={v => set('vinculo', v)} />
          <Input name="proprietario_filtro" label="Proprietário" placeholder="Nome ou CPF/CNPJ..." value={f.proprietario} onChangeValue={v => set('proprietario', v)} />
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

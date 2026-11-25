import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '../../../components/inputs/input';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalBody, ModalFields, ModalFooter, ModalHeader, ModalHighlight, ModalHighlights,
  ModalNotice, ModalSection, ModalSwitch,
} from '../../../components/system';
import { Icons } from '../Icons';
import type { NovoServicoInput, ServicoItem } from '../../../types/servico';

const FORM_VAZIO: NovoServicoInput = { nome: '', categoria: '', preco: 0, duracao: '', descricao: '', ativo: true };

interface ServicoFormModalProps {
  servico?: ServicoItem;              // presente = modo edição
  categoriasDisponiveis: string[];
  onSave: (input: NovoServicoInput) => void;
  /** Erro devolvido pelo servidor ao salvar — o modal fica aberto pra corrigir. */
  erro?: string | null;
  salvando?: boolean;
  onClose: () => void;
}

export function ServicoFormModal({ servico, categoriasDisponiveis, onSave, erro, salvando, onClose }: ServicoFormModalProps) {
  const [form, setForm] = useState<NovoServicoInput>(FORM_VAZIO);
  const editando = !!servico;

  useEffect(() => {
    if (servico) {
      setForm({
        nome: servico.nome,
        categoria: servico.categoria,
        preco: servico.preco,
        duracao: servico.duracao,
        descricao: servico.descricao,
        ativo: servico.ativo,
      });
    }
  }, [servico]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || form.preco <= 0 || !form.categoria.trim() || !form.duracao.trim()) return;
    onSave(form);
  }

  return (
    <Modal size="md" onClose={onClose} onSubmit={handleSubmit}>
      <ModalHeader
        icon={Icons.wrench}
        title={editando ? 'Editar Serviço' : 'Adicionar Serviço'}
        description={editando ? 'Atualize os dados do serviço no catálogo.' : 'Cadastre um novo serviço oferecido pela oficina.'}
      />

      <ModalBody>
        <ModalSection title="Informações básicas">
          <Input
            name="servico_nome"
            label="Nome do Serviço"
            required
            value={form.nome}
            onChangeValue={v => setForm({ ...form, nome: v })}
            placeholder="Ex: Troca de Óleo e Filtro"
          />
          <ModalFields>
            <Input
              name="servico_categoria"
              label="Categoria"
              required
              value={form.categoria}
              onChangeValue={v => setForm({ ...form, categoria: v })}
              placeholder="Ex: Freios"
              datalistOptions={categoriasDisponiveis}
            />
            <Input
              name="servico_duracao"
              label="Duração Estimada"
              required
              value={form.duracao}
              onChangeValue={v => setForm({ ...form, duracao: v })}
              placeholder="Ex: 1h 30min"
            />
          </ModalFields>
        </ModalSection>

        <ModalHighlights>
          <ModalHighlight label="Preço Cobrado" htmlFor="servico_preco" icon={Icons.dollar} required hint="Valor cobrado do cliente pelo serviço">
            <Input
              name="servico_preco"
              type="currency"
              required
              value={form.preco ? String(form.preco) : ''}
              onChangeValue={v => setForm({ ...form, preco: Number(v) || 0 })}
              placeholder="R$ 0,00"
            />
          </ModalHighlight>
        </ModalHighlights>

        <ModalSection title="Detalhes">
          <Textarea
            name="servico_descricao"
            label="Descrição Detalhada"
            value={form.descricao}
            onChangeValue={v => setForm({ ...form, descricao: v })}
            rows={3}
          />
        </ModalSection>

        <ModalSection title="Disponibilidade">
          <ModalSwitch
            label="Serviço ativo"
            description="Visível como opção oferecida pela oficina"
            checked={form.ativo ?? true}
            onChange={v => setForm({ ...form, ativo: v })}
          />
        </ModalSection>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={salvando}>
          {salvando ? 'Salvando…' : editando ? 'Salvar Alterações' : 'Salvar Serviço'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Icons } from '../Icons';
import { comprimirImagem } from '../../../utils/estoque_utils';
import { useServicos } from '../../../hooks/useServicos';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalBody, ModalColumns, ModalFooter, ModalHeader, ModalNotice, ModalSection,
} from '../../../components/system';
import { ProdutoFotoCampo } from './ProdutoFotoCampo';
import type { EstoqueItem, EstoqueKit, EstoqueKitItemReceita, NovoEstoqueKitInput } from '../../../types/estoque';

interface CriarKitModalProps {
  kit?: EstoqueKit;                  // presente = modo edição
  itensDisponiveis: EstoqueItem[];   // reaproveita o que já existe — kit não cadastra item novo aqui
  onSave: (input: NovoEstoqueKitInput) => void;
  /** Erro devolvido pelo servidor ao salvar — o modal fica aberto pra corrigir. */
  erro?: string | null;
  salvando?: boolean;
  onClose: () => void;
}

export function CriarKitModal({ kit, itensDisponiveis, onSave, erro, salvando, onClose }: CriarKitModalProps) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fotoDataUrl, setFotoDataUrl] = useState<string | undefined>(undefined);
  const [servicoId, setServicoId] = useState<string | undefined>(undefined);
  const [comprimindo, setComprimindo] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [receita, setReceita] = useState<EstoqueKitItemReceita[]>([]);
  const editando = !!kit;

  // Fonte da verdade do vínculo Kit ↔ Serviço é o Kit — o Catálogo (ServicoCard)
  // só exibe, não edita. Ver patch em ServicoCard/ServicosPage nesta mesma fase.
  const { servicos } = useServicos();

  useEffect(() => {
    if (kit) {
      setNome(kit.nome);
      setDescricao(kit.descricao ?? '');
      setFotoDataUrl(kit.fotoDataUrl);
      setServicoId(kit.servicoId);
      setReceita(kit.itens);
    }
  }, [kit]);

  const itensPorId = useMemo(() => new Map(itensDisponiveis.map(i => [i.id, i])), [itensDisponiveis]);

  const itensSelecionaveis = useMemo(() => itensDisponiveis.filter(i => i.status === 'ativo'), [itensDisponiveis]);

  const resultadosBusca = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return itensSelecionaveis
      .filter(i => !receita.some(r => r.itemId === i.id) && i.nome.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [busca, itensSelecionaveis, receita]);

  function adicionarItem(item: EstoqueItem) {
    setReceita(prev => [...prev, { itemId: item.id, quantidade: 1 }]);
    setBusca('');
  }

  function removerItem(itemId: string) {
    setReceita(prev => prev.filter(r => r.itemId !== itemId));
  }

  function alterarQuantidade(itemId: string, quantidade: number) {
    setReceita(prev => prev.map(r => (r.itemId === itemId ? { ...r, quantidade: Math.max(1, quantidade) } : r)));
  }

  async function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroFoto(null);
    setComprimindo(true);
    try {
      setFotoDataUrl(await comprimirImagem(file));
    } catch {
      setErroFoto('Não foi possível processar essa imagem. Ela pode estar corrompida ou em formato não aceito (use JPEG, PNG ou WebP). Tente outra foto.');
    } finally {
      setComprimindo(false);
      e.target.value = '';
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || receita.length === 0) return;
    onSave({ nome, descricao, itens: receita, fotoDataUrl, servicoId });
  }

  return (
    <Modal size="xl" onClose={onClose} onSubmit={handleSubmit}>
      <ModalHeader
        icon={Icons.box}
        title={editando ? 'Editar Kit' : 'Criar Kit'}
        description={editando ? 'Atualize a receita e os dados do kit.' : 'Monte um kit a partir de itens já cadastrados no estoque.'}
      />

      <ModalBody>
        <ModalColumns
          aside={
            <ModalSection icon={Icons.camera} title="Foto do kit">
              <ProdutoFotoCampo
                foto={fotoDataUrl}
                comprimindo={comprimindo}
                erro={erroFoto}
                onSelecionar={handleFoto}
                onRemover={() => setFotoDataUrl(undefined)}
              />
            </ModalSection>
          }
        >
          <ModalSection icon={Icons.box} title="Informações do kit">
            <Input
              name="kit_nome"
              label="Nome do Kit"
              required
              value={nome}
              onChangeValue={setNome}
              placeholder="Ex: Kit Revisão Básica Fiat Uno"
            />
            <Textarea name="kit_descricao" label="Descrição" value={descricao} onChangeValue={setDescricao} rows={2} />
            <Select
              name="kit_servico"
              label="Vincular a um Serviço do Catálogo (opcional)"
              value={servicoId ?? ''}
              onChangeValue={v => setServicoId(v || undefined)}
              options={[{ value: '', label: 'Nenhum' }, ...servicos.map(s => ({ value: s.id, label: s.nome }))]}
            />
          </ModalSection>

          <ModalSection
            icon={Icons.clipboardCheck}
            title="Itens do kit"
            description="Busque itens já cadastrados no estoque para montar a receita. Obrigatório: ao menos um item."
            aside={receita.length > 0 ? <span>{receita.length} {receita.length === 1 ? 'item' : 'itens'}</span> : undefined}
          >
            <Input
              name="kit_busca_item"
              type="search"
              value={busca}
              onChangeValue={setBusca}
              placeholder="Buscar item já cadastrado no estoque..."
            />

            {resultadosBusca.length > 0 && (
              <ul className="sys-modal__pick-list">
                {resultadosBusca.map(item => (
                  <li key={item.id}>
                    <button type="button" className="sys-modal__pick" onClick={() => adicionarItem(item)}>
                      <span>{item.nome}</span>
                      <span className="sys-modal__pick-meta">{item.quantidade} un.</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {receita.length === 0 ? (
              <p className="sys-modal__empty">Nenhum item adicionado ainda — busque acima para montar a receita do kit.</p>
            ) : (
              <div className="sys-modal__lines">
                {receita.map(r => (
                  <div key={r.itemId} className="sys-modal__line">
                    <span className="sys-modal__line-name">{itensPorId.get(r.itemId)?.nome ?? 'Item removido'}</span>
                    <div className="sys-modal__line-qty">
                      <Input
                        name={`kit_qtd_${r.itemId}`}
                        type="number"
                        value={String(r.quantidade)}
                        onChangeValue={v => alterarQuantidade(r.itemId, Number(v) || 1)}
                      />
                    </div>
                    <Button variant="danger" size="sm" onClick={() => removerItem(r.itemId)}>Remover</Button>
                  </div>
                ))}
              </div>
            )}
          </ModalSection>
        </ModalColumns>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={salvando} disabled={!nome.trim() || receita.length === 0}>
          {salvando ? 'Salvando…' : editando ? 'Salvar Alterações' : 'Criar Kit'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

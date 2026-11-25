import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Icons } from '../Icons';
import { CATEGORIA_GRUPOS, comprimirImagem } from '../../../utils/estoque_utils';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import {
  Button, Modal, ModalHeader, ModalBody, ModalColumns, ModalSection, ModalFields,
  ModalHighlights, ModalHighlight, ModalNotice, ModalBadge, ModalSwitch, ModalFooter,
} from '../../../components/system';
import type { EstoqueItem, EstoqueItemQuarentena, NovoEstoqueItemInput } from '../../../types/estoque';
import { ProdutoFotoCampo } from './ProdutoFotoCampo';
import { IcImagem, IcInfo, IcTexto } from './icones';

const CATEGORIA_SELECT_OPTIONS = CATEGORIA_GRUPOS.map(({ grupo, categorias }) => ({
  group: grupo,
  options: categorias,
}));

function blankQuarentena(): EstoqueItemQuarentena {
  return { motivo: '', fornecedor: '', dataEntrada: new Date().toISOString().slice(0, 10) };
}

const FORM_VAZIO: NovoEstoqueItemInput = {
  nome: '', categoria: CATEGORIA_GRUPOS[0].categorias[0], quantidade: 0, minimo: 0, preco: 0,
  localizacao: '', descricao: '', aplicacao: '', fotoDataUrl: undefined,
  status: 'ativo', quarentena: undefined,
};

interface ProdutoModalProps {
  item?: EstoqueItem;                 // presente = modo edição
  categoriaInicial?: string;          // pré-preenche ao abrir de dentro de uma categoria
  onSave: (input: NovoEstoqueItemInput) => void;
  /** Erro devolvido pelo servidor ao salvar — o modal fica aberto pra corrigir e tentar de novo. */
  erro?: string | null;
  salvando?: boolean;
  onClose: () => void;
}

export function ProdutoModal({ item, categoriaInicial, onSave, erro, salvando, onClose }: ProdutoModalProps) {
  const [form, setForm] = useState<NovoEstoqueItemInput>(FORM_VAZIO);
  const [comprimindo, setComprimindo] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const editando = !!item;

  useEffect(() => {
    if (item) {
      setForm({
        nome: item.nome,
        categoria: item.categoria,
        quantidade: item.quantidade,
        minimo: item.minimo,
        preco: item.preco,
        localizacao: item.localizacao,
        descricao: item.descricao ?? '',
        aplicacao: item.aplicacao ?? '',
        fotoDataUrl: item.fotoDataUrl,
        status: item.status,
        quarentena: item.quarentena,
      });
    } else if (categoriaInicial) {
      setForm(f => ({ ...f, categoria: categoriaInicial }));
    }
  }, [item, categoriaInicial]);

  const emQuarentena = form.status === 'quarentena';

  function toggleQuarentena(ativa: boolean) {
    setForm(f =>
      ativa
        ? { ...f, status: 'quarentena', quarentena: f.quarentena ?? blankQuarentena() }
        : { ...f, status: 'ativo', quarentena: undefined }
    );
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroFoto(null);
    setComprimindo(true);
    try {
      const dataUrl = await comprimirImagem(file);
      setForm(f => ({ ...f, fotoDataUrl: dataUrl }));
    } catch {
      setErroFoto('Não foi possível processar essa imagem. Ela pode estar corrompida ou em formato não aceito (use JPEG, PNG ou WebP). Tente outra foto.');
    } finally {
      setComprimindo(false);
      e.target.value = '';
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.categoria || !form.localizacao.trim()) return;
    if (form.quantidade < 0 || form.minimo < 0 || form.preco < 0) return;
    if (emQuarentena && (!form.quarentena?.motivo.trim() || !form.quarentena?.fornecedor.trim())) return;
    onSave(form);
  }

  return (
    <Modal size="xl" onClose={onClose} onSubmit={handleSubmit}>
      <ModalHeader
        icon={Icons.box}
        title={editando ? 'Editar Produto' : 'Adicionar Produto'}
        description={editando ? 'Atualize os dados do item no estoque.' : 'Cadastre um novo item no estoque da oficina.'}
        meta={emQuarentena ? <ModalBadge tone="attention">Quarentena</ModalBadge> : undefined}
      />

      <ModalBody>
        <ModalColumns
          aside={
            <>
              <ModalSection icon={IcImagem} title="Foto do produto">
                <ProdutoFotoCampo
                  foto={form.fotoDataUrl}
                  comprimindo={comprimindo}
                  erro={erroFoto}
                  onSelecionar={handleFoto}
                  onRemover={() => setForm(f => ({ ...f, fotoDataUrl: undefined }))}
                />
              </ModalSection>

              <ModalSection icon={Icons.alert} title="Quarentena" tone={emQuarentena ? 'attention' : 'default'}>
                <ModalSwitch
                  label="Item em quarentena"
                  description="Aguardando devolução/garantia"
                  checked={emQuarentena}
                  onChange={toggleQuarentena}
                />
                {emQuarentena && (
                  <>
                    <Input
                      name="quarentena_motivo"
                      label="Motivo"
                      required
                      value={form.quarentena?.motivo ?? ''}
                      onChangeValue={v => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), motivo: v } }))}
                      placeholder="Ex: Peça com defeito de fábrica"
                    />
                    <Input
                      name="quarentena_fornecedor"
                      label="Fornecedor"
                      required
                      value={form.quarentena?.fornecedor ?? ''}
                      onChangeValue={v => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), fornecedor: v } }))}
                      placeholder="Ex: AutoPeças Beta Ltda"
                    />
                    <Input
                      name="quarentena_data"
                      type="date"
                      label="Data de Entrada"
                      value={form.quarentena?.dataEntrada?.slice(0, 10) ?? ''}
                      onChangeValue={v => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), dataEntrada: v } }))}
                    />
                  </>
                )}
              </ModalSection>
            </>
          }
        >
          <ModalSection icon={IcInfo} title="Informações básicas">
            <Input
              name="produto_nome"
              label="Nome do Produto"
              required
              value={form.nome}
              onChangeValue={v => setForm({ ...form, nome: v })}
              placeholder="Ex: Pastilha de Freio Dianteira"
            />
            <ModalFields>
              <Select
                name="produto_categoria"
                label="Categoria"
                required
                value={form.categoria}
                onChangeValue={v => setForm({ ...form, categoria: v })}
                options={CATEGORIA_SELECT_OPTIONS}
              />
              <Input
                name="produto_localizacao"
                label="Localização"
                required
                value={form.localizacao}
                onChangeValue={v => setForm({ ...form, localizacao: v })}
                placeholder="Ex: Prateleira B2"
              />
            </ModalFields>
          </ModalSection>

          <ModalHighlights>
            <ModalHighlight label="Quantidade" htmlFor="produto_quantidade" icon={Icons.box} required hint="Unidades em estoque agora">
              <Input
                name="produto_quantidade"
                type="number"
                required
                value={form.quantidade || form.quantidade === 0 ? String(form.quantidade) : ''}
                onChangeValue={v => setForm({ ...form, quantidade: Number(v) || 0 })}
              />
            </ModalHighlight>
            <ModalHighlight label="Estoque Mínimo" htmlFor="produto_minimo" icon={Icons.alert} required hint="Nessa quantidade ou menos, vira estoque baixo">
              <Input
                name="produto_minimo"
                type="number"
                required
                value={form.minimo || form.minimo === 0 ? String(form.minimo) : ''}
                onChangeValue={v => setForm({ ...form, minimo: Number(v) || 0 })}
              />
            </ModalHighlight>
            <ModalHighlight label="Preço" htmlFor="produto_preco" icon={Icons.dollar} required hint="Valor cobrado por unidade">
              <Input
                name="produto_preco"
                type="currency"
                required
                value={form.preco ? String(form.preco) : ''}
                onChangeValue={v => setForm({ ...form, preco: Number(v) || 0 })}
                placeholder="R$ 0,00"
              />
            </ModalHighlight>
          </ModalHighlights>

          <ModalSection icon={IcTexto} title="Detalhes">
            <Textarea
              name="produto_aplicacao"
              label="Aplicação"
              value={form.aplicacao ?? ''}
              onChangeValue={v => setForm({ ...form, aplicacao: v })}
              placeholder="Ex: Gol 1.6 2016-2019, Voyage 1.6 2015-2018"
              hint="Texto livre — entra na busca por nome/aplicação, além do nome do produto."
              rows={2}
            />
            <Textarea
              name="produto_descricao"
              label="Descrição"
              value={form.descricao ?? ''}
              onChangeValue={v => setForm({ ...form, descricao: v })}
              rows={3}
            />
          </ModalSection>
        </ModalColumns>
      </ModalBody>

      <ModalFooter
        hint="* Campos obrigatórios"
        notice={erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" variant="primary" loading={salvando}>
          {salvando ? 'Salvando…' : editando ? 'Salvar Alterações' : 'Salvar Produto'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

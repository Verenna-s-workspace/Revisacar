import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { tokens } from '../../../constants';
import { Icons, CATEGORIA_ICON } from '../Icons';
import { CATEGORIA_GRUPOS, comprimirImagem } from '../../../utils/estoque_utils';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';
import { Textarea } from '../../../components/inputs/textarea';
import type { EstoqueItem, EstoqueItemQuarentena, NovoEstoqueItemInput } from '../../../types/estoque';

const BTN_SECUNDARIO = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '7px 14px', background: tokens.color.surfaceHigh, color: tokens.color.textSecond,
  border: `1px solid ${tokens.color.border}`, borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
} as const;

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
      setErroFoto('Não foi possível processar essa imagem. Tente outra foto.');
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
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{editando ? 'Editar Produto' : 'Adicionar Produto'}</div>
            <div className="dashboard-modal__subtitle">
              {editando ? 'Atualize os dados do item no estoque.' : 'Cadastre um novo item no estoque da oficina.'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dashboard-modal__body">
            <Input
              name="produto_nome"
              label="Nome do Produto"
              required
              value={form.nome}
              onChangeValue={v => setForm({ ...form, nome: v })}
              placeholder="Ex: Pastilha de Freio Dianteira"
            />

            <div className="dashboard-form-grid-2col" style={{ gap: 12 }}>
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
            </div>

            <div className="dashboard-form-grid-2col" style={{ gap: 12 }}>
              <Input
                name="produto_quantidade"
                type="number"
                label="Quantidade"
                required
                value={form.quantidade || form.quantidade === 0 ? String(form.quantidade) : ''}
                onChangeValue={v => setForm({ ...form, quantidade: Number(v) || 0 })}
              />
              <Input
                name="produto_minimo"
                type="number"
                label="Estoque Mínimo"
                required
                value={form.minimo || form.minimo === 0 ? String(form.minimo) : ''}
                onChangeValue={v => setForm({ ...form, minimo: Number(v) || 0 })}
              />
            </div>

            <Input
              name="produto_preco"
              type="currency"
              label="Preço"
              required
              value={form.preco ? String(form.preco) : ''}
              onChangeValue={v => setForm({ ...form, preco: Number(v) || 0 })}
              placeholder="R$ 0,00"
            />

            <div>
              <Textarea
                name="produto_aplicacao"
                label="Aplicação"
                value={form.aplicacao ?? ''}
                onChangeValue={v => setForm({ ...form, aplicacao: v })}
                placeholder="Ex: Gol 1.6 2016-2019, Voyage 1.6 2015-2018"
                rows={2}
              />
              <span style={{ fontSize: '0.7rem', color: tokens.color.muted }}>
                Texto livre — entra na busca por nome/aplicação, além do nome do produto.
              </span>
            </div>

            <Textarea
              name="produto_descricao"
              label="Descrição"
              value={form.descricao ?? ''}
              onChangeValue={v => setForm({ ...form, descricao: v })}
              rows={3}
            />

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>FOTO DO PRODUTO</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 84, height: 84, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                    background: tokens.color.ferrariMid, color: tokens.color.ferrari,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {form.fotoDataUrl ? (
                    <img src={form.fotoDataUrl} alt="Prévia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ display: 'flex', transform: 'scale(1.8)' }}>{CATEGORIA_ICON[form.categoria] ?? Icons.box}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <label style={{ ...BTN_SECUNDARIO, cursor: comprimindo ? 'wait' : 'pointer' }}>
                    {comprimindo ? 'Processando...' : form.fotoDataUrl ? 'Trocar foto' : 'Adicionar foto'}
                    <input type="file" accept="image/*" onChange={handleFoto} disabled={comprimindo} style={{ display: 'none' }} />
                  </label>
                  {form.fotoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, fotoDataUrl: undefined }))}
                      style={{ ...BTN_SECUNDARIO, color: tokens.color.crit, background: 'transparent', border: 'none', padding: '2px 4px' }}
                    >
                      Remover foto
                    </button>
                  )}
                  {erroFoto && <span style={{ fontSize: '0.72rem', color: tokens.color.crit }}>{erroFoto}</span>}
                </div>
              </div>
              <div className="dashboard-modal__remark" style={{ marginTop: 10 }}>
                <div className="dashboard-modal__remark-label">AVISO</div>
                <div className="dashboard-modal__remark-text">
                  A foto fica salva só nesta sessão — ainda não há backend de armazenamento pra imagens.
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emQuarentena}
                  onChange={e => toggleQuarentena(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: tokens.color.warn }}
                />
                <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond, fontWeight: 600 }}>
                  Item em quarentena (aguardando devolução/garantia)
                </span>
              </label>

              {emQuarentena && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Input
                    name="quarentena_motivo"
                    label="Motivo"
                    required
                    value={form.quarentena?.motivo ?? ''}
                    onChangeValue={v => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), motivo: v } }))}
                    placeholder="Ex: Peça com defeito de fábrica"
                  />
                  <div className="dashboard-form-grid-2col" style={{ gap: 12 }}>
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
                  </div>
                </div>
              )}
            </div>
          </div>

          {erro && (
            <div role="alert" style={{ margin: '0 24px 12px', padding: '10px 12px', borderRadius: 8, background: tokens.color.critBg, color: tokens.color.crit, fontSize: '0.8rem', fontWeight: 600 }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: `1px solid ${tokens.color.border}` }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.textSecond, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              style={{ padding: '10px 20px', background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? 'Salvando…' : editando ? 'Salvar Alterações' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

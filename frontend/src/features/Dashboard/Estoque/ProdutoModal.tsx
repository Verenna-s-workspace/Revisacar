import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { tokens } from '../../../constants';
import { Icons, CATEGORIA_ICON } from '../Icons';
import { CATEGORIA_GRUPOS, comprimirImagem } from '../../../utils/estoque_utils';
import type { EstoqueItem, EstoqueItemQuarentena, NovoEstoqueItemInput } from '../../../types/estoque';

const FIELD_LABEL: CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 700,
  color: tokens.color.textSecond, marginBottom: 5,
};

const FIELD_INPUT: CSSProperties = {
  width: '100%', padding: 10, background: tokens.color.bg,
  border: `1px solid ${tokens.color.border}`, borderRadius: 8,
  color: tokens.color.text, fontSize: '0.875rem', fontFamily: tokens.fontSans,
};

const BTN_SECUNDARIO: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '7px 14px', background: tokens.color.surfaceHigh, color: tokens.color.textSecond,
  border: `1px solid ${tokens.color.border}`, borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
};

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
  onClose: () => void;
}

export function ProdutoModal({ item, categoriaInicial, onSave, onClose }: ProdutoModalProps) {
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
            <div>
              <label style={FIELD_LABEL}>NOME DO PRODUTO *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Pastilha de Freio Dianteira"
                style={FIELD_INPUT}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={FIELD_LABEL}>CATEGORIA *</label>
                <select
                  required
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                  style={FIELD_INPUT}
                >
                  {CATEGORIA_GRUPOS.map(({ grupo, categorias }) => (
                    <optgroup key={grupo} label={grupo}>
                      {categorias.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={FIELD_LABEL}>LOCALIZAÇÃO *</label>
                <input
                  type="text"
                  required
                  value={form.localizacao}
                  onChange={e => setForm({ ...form, localizacao: e.target.value })}
                  placeholder="Ex: Prateleira B2"
                  style={FIELD_INPUT}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={FIELD_LABEL}>QUANTIDADE *</label>
                <input
                  type="number" min="0" step="1" required
                  value={form.quantidade || form.quantidade === 0 ? form.quantidade : ''}
                  onChange={e => setForm({ ...form, quantidade: Number(e.target.value) })}
                  style={FIELD_INPUT}
                />
              </div>
              <div>
                <label style={FIELD_LABEL}>ESTOQUE MÍNIMO *</label>
                <input
                  type="number" min="0" step="1" required
                  value={form.minimo || form.minimo === 0 ? form.minimo : ''}
                  onChange={e => setForm({ ...form, minimo: Number(e.target.value) })}
                  style={FIELD_INPUT}
                />
              </div>
            </div>

            <div>
              <label style={FIELD_LABEL}>PREÇO (R$) *</label>
              <input
                type="number" step="0.01" min="0" required
                value={form.preco || ''}
                onChange={e => setForm({ ...form, preco: Number(e.target.value) })}
                placeholder="Ex: 95.00"
                style={FIELD_INPUT}
              />
            </div>

            <div>
              <label style={FIELD_LABEL}>APLICAÇÃO</label>
              <textarea
                value={form.aplicacao}
                onChange={e => setForm({ ...form, aplicacao: e.target.value })}
                placeholder="Ex: Gol 1.6 2016-2019, Voyage 1.6 2015-2018"
                style={{ ...FIELD_INPUT, height: 48, resize: 'none' }}
              />
              <span style={{ fontSize: '0.7rem', color: tokens.color.muted }}>
                Texto livre — entra na busca por nome/aplicação, além do nome do produto.
              </span>
            </div>

            <div>
              <label style={FIELD_LABEL}>DESCRIÇÃO</label>
              <textarea
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                style={{ ...FIELD_INPUT, height: 70, resize: 'none' }}
              />
            </div>

            <div>
              <label style={FIELD_LABEL}>FOTO DO PRODUTO</label>
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
                  <div>
                    <label style={FIELD_LABEL}>MOTIVO *</label>
                    <input
                      type="text"
                      required
                      value={form.quarentena?.motivo ?? ''}
                      onChange={e => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), motivo: e.target.value } }))}
                      placeholder="Ex: Peça com defeito de fábrica"
                      style={FIELD_INPUT}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={FIELD_LABEL}>FORNECEDOR *</label>
                      <input
                        type="text"
                        required
                        value={form.quarentena?.fornecedor ?? ''}
                        onChange={e => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), fornecedor: e.target.value } }))}
                        placeholder="Ex: AutoPeças Beta Ltda"
                        style={FIELD_INPUT}
                      />
                    </div>
                    <div>
                      <label style={FIELD_LABEL}>DATA DE ENTRADA</label>
                      <input
                        type="date"
                        value={form.quarentena?.dataEntrada?.slice(0, 10) ?? ''}
                        onChange={e => setForm(f => ({ ...f, quarentena: { ...(f.quarentena ?? blankQuarentena()), dataEntrada: e.target.value } }))}
                        style={FIELD_INPUT}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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
              style={{ padding: '10px 20px', background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
            >
              {editando ? 'Salvar Alterações' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { tokens } from '../../../constants';
import type { NovoServicoInput, ServicoItem } from '../../../types/servico';

const FIELD_LABEL: CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 700,
  color: tokens.color.textSecond, marginBottom: 5,
};

const FIELD_INPUT: CSSProperties = {
  width: '100%', padding: 10, background: tokens.color.bg,
  border: `1px solid ${tokens.color.border}`, borderRadius: 8,
  color: tokens.color.text, fontSize: '0.875rem', fontFamily: tokens.fontSans,
};

const FORM_VAZIO: NovoServicoInput = { nome: '', categoria: '', preco: 0, duracao: '', descricao: '', ativo: true };

interface ServicoFormModalProps {
  servico?: ServicoItem;              // presente = modo edição
  categoriasDisponiveis: string[];
  onSave: (input: NovoServicoInput) => void;
  onClose: () => void;
}

export function ServicoFormModal({ servico, categoriasDisponiveis, onSave, onClose }: ServicoFormModalProps) {
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
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{editando ? 'Editar Serviço' : 'Adicionar Serviço'}</div>
            <div className="dashboard-modal__subtitle">
              {editando ? 'Atualize os dados do serviço no catálogo.' : 'Cadastre um novo serviço oferecido pela oficina.'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dashboard-modal__body">
            <div>
              <label style={FIELD_LABEL}>NOME DO SERVIÇO *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Troca de Óleo e Filtro"
                style={FIELD_INPUT}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={FIELD_LABEL}>CATEGORIA *</label>
                <input
                  type="text"
                  required
                  list="categorias-servico"
                  value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Ex: Freios"
                  style={FIELD_INPUT}
                />
                <datalist id="categorias-servico">
                  {categoriasDisponiveis.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label style={FIELD_LABEL}>DURAÇÃO ESTIMADA *</label>
                <input
                  type="text"
                  required
                  value={form.duracao}
                  onChange={e => setForm({ ...form, duracao: e.target.value })}
                  placeholder="Ex: 1h 30min"
                  style={FIELD_INPUT}
                />
              </div>
            </div>

            <div>
              <label style={FIELD_LABEL}>PREÇO COBRADO (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.preco || ''}
                onChange={e => setForm({ ...form, preco: Number(e.target.value) })}
                placeholder="Ex: 250.00"
                style={FIELD_INPUT}
              />
            </div>

            <div>
              <label style={FIELD_LABEL}>DESCRIÇÃO DETALHADA</label>
              <textarea
                value={form.descricao}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                style={{ ...FIELD_INPUT, height: 80, resize: 'none' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.ativo ?? true}
                onChange={e => setForm({ ...form, ativo: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: tokens.color.ferrari }}
              />
              <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>
                Serviço ativo (visível como opção oferecida pela oficina)
              </span>
            </label>
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
              {editando ? 'Salvar Alterações' : 'Salvar Serviço'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { tokens } from '../../../constants';
import { Input } from '../../../components/inputs/input';
import { Textarea } from '../../../components/inputs/textarea';
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
            <Input
              name="servico_nome"
              label="Nome do Serviço"
              required
              value={form.nome}
              onChangeValue={v => setForm({ ...form, nome: v })}
              placeholder="Ex: Troca de Óleo e Filtro"
            />

            <div className="dashboard-form-grid-2col" style={{ gap: 12 }}>
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
            </div>

            <Input
              name="servico_preco"
              type="currency"
              label="Preço Cobrado"
              required
              value={form.preco ? String(form.preco) : ''}
              onChangeValue={v => setForm({ ...form, preco: Number(v) || 0 })}
              placeholder="R$ 0,00"
            />

            <Textarea
              name="servico_descricao"
              label="Descrição Detalhada"
              value={form.descricao}
              onChangeValue={v => setForm({ ...form, descricao: v })}
              rows={3}
            />

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
              {salvando ? 'Salvando…' : editando ? 'Salvar Alterações' : 'Salvar Serviço'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

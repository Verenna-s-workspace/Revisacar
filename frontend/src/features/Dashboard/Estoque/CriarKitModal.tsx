import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { comprimirImagem } from '../../../utils/estoque_utils';
import { useServicos } from '../../../hooks/useServicos';
import type { EstoqueItem, EstoqueKit, EstoqueKitItemReceita, NovoEstoqueKitInput } from '../../../types/estoque';

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

interface CriarKitModalProps {
  kit?: EstoqueKit;                  // presente = modo edição
  itensDisponiveis: EstoqueItem[];   // reaproveita o que já existe — kit não cadastra item novo aqui
  onSave: (input: NovoEstoqueKitInput) => void;
  onClose: () => void;
}

export function CriarKitModal({ kit, itensDisponiveis, onSave, onClose }: CriarKitModalProps) {
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

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroFoto(null);
    setComprimindo(true);
    try {
      setFotoDataUrl(await comprimirImagem(file));
    } catch {
      setErroFoto('Não foi possível processar essa imagem. Tente outra foto.');
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
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">{editando ? 'Editar Kit' : 'Criar Kit'}</div>
            <div className="dashboard-modal__subtitle">
              {editando ? 'Atualize a receita e os dados do kit.' : 'Monte um kit a partir de itens já cadastrados no estoque.'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dashboard-modal__body">
            <div>
              <label style={FIELD_LABEL}>NOME DO KIT *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: Kit Revisão Básica Fiat Uno"
                style={FIELD_INPUT}
              />
            </div>

            <div>
              <label style={FIELD_LABEL}>DESCRIÇÃO</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                style={{ ...FIELD_INPUT, height: 60, resize: 'none' }}
              />
            </div>

            <div>
              <label style={FIELD_LABEL}>VINCULAR A UM SERVIÇO DO CATÁLOGO (OPCIONAL)</label>
              <select value={servicoId ?? ''} onChange={e => setServicoId(e.target.value || undefined)} style={FIELD_INPUT}>
                <option value="">Nenhum</option>
                {servicos.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={FIELD_LABEL}>FOTO DO KIT</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 72, height: 72, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                    background: tokens.color.ferrariMid, color: tokens.color.ferrari,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {fotoDataUrl ? <img src={fotoDataUrl} alt="Prévia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : Icons.box}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <label style={{ ...BTN_SECUNDARIO, cursor: comprimindo ? 'wait' : 'pointer' }}>
                    {comprimindo ? 'Processando...' : fotoDataUrl ? 'Trocar foto' : 'Adicionar foto'}
                    <input type="file" accept="image/*" onChange={handleFoto} disabled={comprimindo} style={{ display: 'none' }} />
                  </label>
                  {erroFoto && <span style={{ fontSize: '0.72rem', color: tokens.color.crit }}>{erroFoto}</span>}
                </div>
              </div>
              <div className="dashboard-modal__remark" style={{ marginTop: 10 }}>
                <div className="dashboard-modal__remark-label">AVISO</div>
                <div className="dashboard-modal__remark-text">A foto fica salva só nesta sessão — ainda não há backend de armazenamento pra imagens.</div>
              </div>
            </div>

            <div>
              <label style={FIELD_LABEL}>ITENS DO KIT *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar item já cadastrado no estoque..."
                  style={FIELD_INPUT}
                />
                {resultadosBusca.length > 0 && (
                  <div
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      background: 'white', border: `1px solid ${tokens.color.border}`, borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 20, maxHeight: 190, overflowY: 'auto',
                    }}
                  >
                    {resultadosBusca.map(item => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => adicionarItem(item)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', width: '100%', padding: '9px 12px',
                          background: 'transparent', border: 'none', borderBottom: `1px solid ${tokens.color.border}`,
                          cursor: 'pointer', textAlign: 'left', fontSize: '0.82rem', color: tokens.color.text,
                        }}
                      >
                        <span>{item.nome}</span>
                        <span style={{ color: tokens.color.muted, flexShrink: 0, marginLeft: 8 }}>{item.quantidade} un.</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {receita.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: tokens.color.muted, padding: '10px 0 0' }}>
                  Nenhum item adicionado ainda — busque acima pra montar a receita do kit.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {receita.map(r => (
                    <div
                      key={r.itemId}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8 }}
                    >
                      <span style={{ flex: 1, fontSize: '0.82rem', color: tokens.color.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {itensPorId.get(r.itemId)?.nome ?? 'Item removido'}
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={r.quantidade}
                        onChange={e => alterarQuantidade(r.itemId, Number(e.target.value))}
                        style={{ width: 56, padding: '6px 8px', border: `1px solid ${tokens.color.border}`, borderRadius: 6, fontSize: '0.8rem', textAlign: 'center' }}
                      />
                      <button
                        type="button"
                        onClick={() => removerItem(r.itemId)}
                        title="Remover"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.crit, display: 'flex' }}
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  ))}
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
              disabled={!nome.trim() || receita.length === 0}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700,
                background: !nome.trim() || receita.length === 0 ? tokens.color.surfaceHigh : tokens.color.ferrari,
                color: !nome.trim() || receita.length === 0 ? tokens.color.ghost : 'white',
                cursor: !nome.trim() || receita.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {editando ? 'Salvar Alterações' : 'Criar Kit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

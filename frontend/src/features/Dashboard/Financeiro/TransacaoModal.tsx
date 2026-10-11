import { useState } from 'react';
import { tokens } from '../../../constants';
import { labelCategoria, LABEL_FORMA_PAGAMENTO } from './categoriaLabels';
import type { Categorias, Transacao } from './types';
import { mensagemDoErro } from '../../../utils/api_erro';
import { hojeLocal } from '../../../utils/financeiro_utils';
import { Input } from '../../../components/inputs/input';
import { Select } from '../../../components/inputs/select';

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 700,
  color: tokens.color.textSecond, marginBottom: 5,
};

interface Props {
  categorias: Categorias;
  /** Quando vem, o modal edita este lançamento (o tipo não muda). */
  transacao?: Transacao;
  onFechar: () => void;
  onSalvar: (payload: Record<string, unknown>) => Promise<void>;
}

export function TransacaoModal({ categorias, transacao, onFechar, onSalvar }: Props) {
  const editando = !!transacao;
  const [tipo, setTipo] = useState<'entrada' | 'saida'>(transacao?.tipo ?? 'entrada');
  const [categoria, setCategoria] = useState(transacao?.categoria ?? categorias.entrada[0] ?? '');
  const [descricao, setDescricao] = useState(transacao?.descricao ?? '');
  const [valor, setValor] = useState(transacao ? String(transacao.valor) : '');
  const [formaPagamento, setFormaPagamento] = useState(transacao?.forma_pagamento ?? 'pix');
  const [statusPago, setStatusPago] = useState(transacao ? transacao.status === 'pago' : true);
  const [dataCompetencia, setDataCompetencia] = useState(transacao?.data_competencia ?? hojeLocal());
  const [dataVencimento, setDataVencimento] = useState(transacao?.data_vencimento ?? '');
  const [clienteNome, setClienteNome] = useState(transacao?.cliente_nome ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const listaCategorias = tipo === 'entrada' ? categorias.entrada : categorias.saida;

  const trocarTipo = (novo: 'entrada' | 'saida') => {
    if (editando) return;
    setTipo(novo);
    const lista = novo === 'entrada' ? categorias.entrada : categorias.saida;
    setCategoria(lista[0] ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) {
      setErro('Informe um valor válido');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        // Na edição o tipo não vai: o backend não deixa mudar.
        ...(editando ? {} : { tipo }),
        categoria,
        descricao,
        valor: valorNum,
        forma_pagamento: formaPagamento,
        status: statusPago ? 'pago' : 'pendente',
        data_competencia: dataCompetencia,
        data_vencimento: !statusPago && dataVencimento ? dataVencimento : null,
        cliente_nome: tipo === 'entrada' ? clienteNome : '',
      });
    } catch (err) {
      setErro(mensagemDoErro(err, 'Erro ao salvar lançamento'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: tokens.color.card, borderRadius: 16, width: '100%', maxWidth: 480,
        border: `1px solid ${tokens.color.border}`, boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>{editando ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
          <button onClick={onFechar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>TIPO</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" disabled={editando} onClick={() => trocarTipo('entrada')} style={{
                flex: 1, padding: 12, background: tipo === 'entrada' ? 'var(--color-ok-bg)' : 'transparent',
                color: tipo === 'entrada' ? 'var(--color-ok)' : tokens.color.textSecond,
                border: `1px solid ${tipo === 'entrada' ? 'var(--color-ok)' : tokens.color.border}`,
                borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}>
                Entrada (+)
              </button>
              <button type="button" disabled={editando} onClick={() => trocarTipo('saida')} style={{
                flex: 1, padding: 12, background: tipo === 'saida' ? 'var(--color-crit-bg)' : 'transparent',
                color: tipo === 'saida' ? 'var(--color-crit)' : tokens.color.textSecond,
                border: `1px solid ${tipo === 'saida' ? 'var(--color-crit)' : tokens.color.border}`,
                borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}>
                Saída (-)
              </button>
            </div>
          </div>

          <Input name="transacao_descricao" label="Descrição" placeholder="Ex: Troca de óleo ou Aluguel" value={descricao} onChangeValue={setDescricao} />

          <div className="dashboard-form-grid-2col" style={{ gap: 12 }}>
            <Input name="transacao_valor" type="currency" label="Valor" required placeholder="R$ 0,00" value={valor} onChangeValue={setValor} />
            <Select
              name="transacao_categoria"
              label="Categoria"
              value={categoria}
              onChangeValue={setCategoria}
              options={listaCategorias.map(c => ({ value: c, label: labelCategoria(tipo, c) }))}
            />
          </div>

          {tipo === 'entrada' && (
            <Input name="transacao_cliente" label="Cliente (opcional)" placeholder="Nome do cliente" value={clienteNome} onChangeValue={setClienteNome} />
          )}

          <div className="dashboard-form-grid-2col" style={{ gap: 12 }}>
            <Input name="transacao_data" type="date" label="Data" value={dataCompetencia} onChangeValue={setDataCompetencia} />
            <Select
              name="transacao_forma_pagamento"
              label="Forma de Pagamento"
              value={formaPagamento}
              onChangeValue={setFormaPagamento}
              options={categorias.formas_pagamento.map(f => ({ value: f, label: LABEL_FORMA_PAGAMENTO[f] ?? f }))}
            />
          </div>

          <div>
            <label style={labelStyle}>STATUS</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStatusPago(true)} style={{
                flex: 1, padding: 10, background: statusPago ? tokens.color.surfaceHigh : 'transparent',
                border: `1px solid ${tokens.color.border}`, borderRadius: 8,
                fontWeight: 700, fontSize: '0.82rem', color: tokens.color.text, cursor: 'pointer',
              }}>
                Já {tipo === 'entrada' ? 'recebido' : 'pago'}
              </button>
              <button type="button" onClick={() => setStatusPago(false)} style={{
                flex: 1, padding: 10, background: !statusPago ? tokens.color.surfaceHigh : 'transparent',
                border: `1px solid ${tokens.color.border}`, borderRadius: 8,
                fontWeight: 700, fontSize: '0.82rem', color: tokens.color.text, cursor: 'pointer',
              }}>
                Pendente
              </button>
            </div>
          </div>

          {!statusPago && (
            <Input name="transacao_vencimento" type="date" label="Vence em (opcional)" value={dataVencimento} onChangeValue={setDataVencimento} />
          )}

          {erro && <p style={{ color: tokens.color.crit, fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>{erro}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" onClick={onFechar} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.textSecond, fontSize: '0.85rem', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{ padding: '10px 20px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

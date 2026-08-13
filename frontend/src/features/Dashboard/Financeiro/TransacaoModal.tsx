import { useState } from 'react';
import { tokens } from '../../../constants';
import { labelCategoria, LABEL_FORMA_PAGAMENTO } from './categoriaLabels';
import type { Categorias } from './types';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 10, background: tokens.color.bg,
  border: `1px solid ${tokens.color.border}`, borderRadius: 8,
  color: tokens.color.text, fontSize: '0.875rem',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 700,
  color: tokens.color.textSecond, marginBottom: 5,
};

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  categorias: Categorias;
  onFechar: () => void;
  onSalvar: (payload: Record<string, unknown>) => Promise<void>;
}

export function TransacaoModal({ categorias, onFechar, onSalvar }: Props) {
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [categoria, setCategoria] = useState(categorias.entrada[0] ?? '');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [statusPago, setStatusPago] = useState(true);
  const [dataCompetencia, setDataCompetencia] = useState(hoje());
  const [dataVencimento, setDataVencimento] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const listaCategorias = tipo === 'entrada' ? categorias.entrada : categorias.saida;

  const trocarTipo = (novo: 'entrada' | 'saida') => {
    setTipo(novo);
    const lista = novo === 'entrada' ? categorias.entrada : categorias.saida;
    setCategoria(lista[0] ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = Number(valor.replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      setErro('Informe um valor válido');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        tipo,
        categoria,
        descricao,
        valor: valorNum,
        forma_pagamento: formaPagamento,
        status: statusPago ? 'pago' : 'pendente',
        data_competencia: dataCompetencia,
        data_vencimento: !statusPago && dataVencimento ? dataVencimento : null,
        cliente_nome: clienteNome,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message.replace(/"/g, '') : 'Erro ao salvar lançamento');
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
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Novo Lançamento</h3>
          <button onClick={onFechar} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>TIPO</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => trocarTipo('entrada')} style={{
                flex: 1, padding: 12, background: tipo === 'entrada' ? 'var(--color-ok-bg)' : 'transparent',
                color: tipo === 'entrada' ? 'var(--color-ok)' : tokens.color.textSecond,
                border: `1px solid ${tipo === 'entrada' ? 'var(--color-ok)' : tokens.color.border}`,
                borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}>
                Entrada (+)
              </button>
              <button type="button" onClick={() => trocarTipo('saida')} style={{
                flex: 1, padding: 12, background: tipo === 'saida' ? 'var(--color-crit-bg)' : 'transparent',
                color: tipo === 'saida' ? 'var(--color-crit)' : tokens.color.textSecond,
                border: `1px solid ${tipo === 'saida' ? 'var(--color-crit)' : tokens.color.border}`,
                borderRadius: 8, fontWeight: 700, cursor: 'pointer',
              }}>
                Saída (-)
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>DESCRIÇÃO</label>
            <input type="text" placeholder="Ex: Troca de óleo ou Aluguel" value={descricao} onChange={e => setDescricao(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>VALOR (R$) *</label>
              <input type="text" inputMode="decimal" required placeholder="150,00" value={valor} onChange={e => setValor(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>CATEGORIA</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle}>
                {listaCategorias.map(c => <option key={c} value={c}>{labelCategoria(tipo, c)}</option>)}
              </select>
            </div>
          </div>

          {tipo === 'entrada' && (
            <div>
              <label style={labelStyle}>CLIENTE (OPCIONAL)</label>
              <input type="text" placeholder="Nome do cliente" value={clienteNome} onChange={e => setClienteNome(e.target.value)} style={inputStyle} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>DATA</label>
              <input type="date" value={dataCompetencia} onChange={e => setDataCompetencia(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>FORMA DE PAGAMENTO</label>
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={inputStyle}>
                {categorias.formas_pagamento.map(f => <option key={f} value={f}>{LABEL_FORMA_PAGAMENTO[f] ?? f}</option>)}
              </select>
            </div>
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
            <div>
              <label style={labelStyle}>VENCE EM (OPCIONAL)</label>
              <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} style={inputStyle} />
            </div>
          )}

          {erro && <p style={{ color: tokens.color.crit, fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>{erro}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" onClick={onFechar} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.textSecond, fontSize: '0.85rem', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{ padding: '10px 20px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
              {salvando ? 'Salvando…' : 'Registrar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

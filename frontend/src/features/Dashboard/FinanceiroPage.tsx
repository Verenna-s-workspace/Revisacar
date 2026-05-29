import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';

interface Transacao {
  id: string;
  descricao: string;
  categoria: string;
  tipo: 'receita' | 'despesa';
  valor: number;
  data: string;
  status: 'concluido' | 'pendente';
}

const MOCK_TRANSACAOS: Transacao[] = [
  { id: '1', descricao: 'Troca de Óleo - Civic PXP-4B22', categoria: 'Serviços', tipo: 'receita', valor: 180.00, data: '22 Mai 2026', status: 'concluido' },
  { id: '2', descricao: 'Pastilhas de Freio - Corolla ABC-1234', categoria: 'Serviços', tipo: 'receita', valor: 320.00, data: '22 Mai 2026', status: 'concluido' },
  { id: '3', descricao: 'Compra de Óleo e Filtros em Lote', categoria: 'Peças', tipo: 'despesa', valor: 1200.00, data: '20 Mai 2026', status: 'concluido' },
  { id: '4', descricao: 'Manutenção de Elevador Automotivo', categoria: 'Estrutura', tipo: 'despesa', valor: 350.00, data: '18 Mai 2026', status: 'concluido' },
  { id: '5', descricao: 'Serviço de Alinhamento - Uno KAS-4012', categoria: 'Serviços', tipo: 'receita', valor: 150.00, data: '15 Mai 2026', status: 'concluido' },
  { id: '6', descricao: 'Energia Elétrica / Luz da Oficina', categoria: 'Serviços Públicos', tipo: 'despesa', valor: 240.00, data: '10 Mai 2026', status: 'concluido' },
  { id: '7', descricao: 'Revisão Completa - Onix ONX-1020', categoria: 'Serviços', tipo: 'receita', valor: 850.00, data: '08 Mai 2026', status: 'concluido' },
];

export function FinanceiroPage({ isMobile }: { isMobile: boolean }) {
  const [transacoes, setTransacoes] = useState<Transacao[]>(MOCK_TRANSACAOS);
  const [showModal, setShowModal] = useState(false);
  const [newTrans, setNewTrans] = useState({ descricao: '', categoria: 'Serviços', tipo: 'receita' as 'receita' | 'despesa', valor: 0.0, status: 'concluido' as 'concluido' | 'pendente' });

  const totalReceitas = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const totalDespesas = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);
  const saldoLiquido = totalReceitas - totalDespesas;
  const margemLucro = totalReceitas > 0 ? Math.round((saldoLiquido / totalReceitas) * 100) : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrans.descricao || newTrans.valor <= 0) return;
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      .replace('.', ' ').replace(/\b(\w)/g, c => c.toUpperCase());

    const t: Transacao = {
      id: String(transacoes.length + 1),
      descricao: newTrans.descricao,
      categoria: newTrans.categoria,
      tipo: newTrans.tipo,
      valor: Number(newTrans.valor),
      data: formattedDate,
      status: newTrans.status,
    };

    setTransacoes([t, ...transacoes]);
    setShowModal(false);
    setNewTrans({ descricao: '', categoria: 'Serviços', tipo: 'receita', valor: 0.0, status: 'concluido' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Gestão Financeira</h2>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Monitore receitas, despesas e fluxo de caixa de sua oficina.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'var(--color-ferrari)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            transition: 'var(--transition-fast)',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          {Icons.plus} Novo Lançamento
        </button>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 20, borderLeft: '4px solid var(--color-ok)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.color.muted }}>TOTAL DE RECEITAS</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-ok-bg)', color: 'var(--color-ok)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ↑
            </span>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: tokens.color.text, margin: '8px 0 2px' }}>
            R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <span style={{ fontSize: '0.74rem', color: tokens.color.muted }}>Faturamento acumulado</span>
        </Card>

        <Card style={{ padding: 20, borderLeft: '4px solid var(--color-crit)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.color.muted }}>TOTAL DE CUSTOS / DESPESAS</span>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-crit-bg)', color: 'var(--color-crit)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ↓
            </span>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: tokens.color.text, margin: '8px 0 2px' }}>
            R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <span style={{ fontSize: '0.74rem', color: tokens.color.muted }}>Peças, pessoal e infraestrutura</span>
        </Card>

        <Card style={{ padding: 20, borderLeft: `4px solid ${saldoLiquido >= 0 ? '#1A7F4B' : 'var(--color-crit)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.color.muted }}>SALDO LÍQUIDO</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1A7F4B' }}>{margemLucro}% margem</span>
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: tokens.color.text, margin: '8px 0 2px' }}>
            R$ {saldoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
          <span style={{ fontSize: '0.74rem', color: tokens.color.muted }}>Lucro líquido restante</span>
        </Card>
      </div>

      {/* Transaction List Card */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Lançamentos Recentes</span>
          <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>{transacoes.length} transações registradas</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.color.border}`, background: tokens.color.surfaceHigh }}>
                <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Descrição</th>
                <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Categoria</th>
                <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Data</th>
                <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'right' }}>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.map(t => {
                const isReceita = t.tipo === 'receita';
                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: `1px solid ${tokens.color.border}`,
                      transition: 'var(--transition-fast)',
                    }}
                    className="checklist-item"
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: isReceita ? 'var(--color-ok-bg)' : 'var(--color-crit-bg)',
                          color: isReceita ? 'var(--color-ok)' : 'var(--color-crit)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {isReceita ? '+' : '-'}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: tokens.color.text }}>{t.descricao}</div>
                          <div style={{ fontSize: '0.74rem', color: tokens.color.muted }}>ID: #{t.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '0.82rem', color: tokens.color.textSecond }}>
                      {t.categoria}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '0.82rem', color: tokens.color.muted }}>
                      {t.data}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 10,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: t.status === 'concluido' ? 'var(--color-ok-bg)' : 'var(--color-warn-bg)',
                        color: t.status === 'concluido' ? 'var(--color-ok)' : 'var(--color-warn)',
                        border: `1px solid ${t.status === 'concluido' ? 'var(--color-ok-border)' : 'var(--color-warn-border)'}`
                      }}>
                        {t.status === 'concluido' ? 'Concluído' : 'Pendente'}
                      </span>
                    </td>
                    <td style={{
                      padding: '14px 20px',
                      textAlign: 'right',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      color: isReceita ? 'var(--color-ok)' : 'var(--color-text)'
                    }}>
                      {isReceita ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Transaction Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: tokens.color.card,
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            border: `1px solid ${tokens.color.border}`,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Registrar Novo Lançamento</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>TIPO DE LANÇAMENTO</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNewTrans({ ...newTrans, tipo: 'receita' })}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: newTrans.tipo === 'receita' ? 'var(--color-ok-bg)' : 'transparent',
                      color: newTrans.tipo === 'receita' ? 'var(--color-ok)' : tokens.color.textSecond,
                      border: `1px solid ${newTrans.tipo === 'receita' ? 'var(--color-ok)' : tokens.color.border}`,
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Receita (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTrans({ ...newTrans, tipo: 'despesa' })}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: newTrans.tipo === 'despesa' ? 'var(--color-crit-bg)' : 'transparent',
                      color: newTrans.tipo === 'despesa' ? 'var(--color-crit)' : tokens.color.textSecond,
                      border: `1px solid ${newTrans.tipo === 'despesa' ? 'var(--color-crit)' : tokens.color.border}`,
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Despesa (-)
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>DESCRIÇÃO *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de Óleo ou Aluguel"
                  value={newTrans.descricao}
                  onChange={e => setNewTrans({ ...newTrans, descricao: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>VALOR (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newTrans.valor || ''}
                    onChange={e => setNewTrans({ ...newTrans, valor: Number(e.target.value) })}
                    placeholder="Ex: 150.00"
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>CATEGORIA</label>
                  <select
                    value={newTrans.categoria}
                    onChange={e => setNewTrans({ ...newTrans, categoria: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  >
                    <option>Serviços</option>
                    <option>Peças</option>
                    <option>Estrutura</option>
                    <option>Impostos</option>
                    <option>Serviços Públicos</option>
                    <option>Outros</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>STATUS</label>
                <select
                  value={newTrans.status}
                  onChange={e => setNewTrans({ ...newTrans, status: e.target.value as any })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                >
                  <option value="concluido">Concluído / Pago</option>
                  <option value="pendente">Pendente / A Receber</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.textSecond, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'var(--color-ferrari)', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Registrar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

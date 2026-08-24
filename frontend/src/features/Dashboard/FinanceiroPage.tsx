import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';
import { useDashboard } from '../../hooks/useDashboard';
import { Sidebar, MobileNav } from './Navigation';
import type { NavPage } from '../types/dashboard';

export function FinanceiroPage({ isMobile, onNav, onNewOS }: { isMobile: boolean; onNav: (p: NavPage) => void; onNewOS: () => void }) {
  const { data, loading } = useDashboard();
  const [showModal, setShowModal] = useState(false);
  const [newTrans, setNewTrans] = useState({ descricao: '', categoria: 'Serviços', tipo: 'receita' as 'receita' | 'despesa', valor: 0.0, status: 'concluido' as 'concluido' | 'pendente' });

  // Derive financial data from the dashboard data (which comes from real service orders)
  const totalReceitas = data?.receitas ?? 0;
  const totalDespesas = data?.custos ?? 0;
  const saldoLiquido = totalReceitas - totalDespesas;
  const margemLucro = totalReceitas > 0 ? Math.round((saldoLiquido / totalReceitas) * 100) : 0;

  // Note: Detailed financial transactions would require additional API endpoints
  // For now, we're showing derived financial data from service orders
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrans.descricao || newTrans.valor <= 0) return;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      .replace('.', ' ').replace(/\b(\w)/g, c => c.toUpperCase());

    const t = {
      id: String(Date.now()), // Temporary ID for mock transaction
      descricao: newTrans.descricao,
      categoria: newTrans.categoria,
      tipo: newTrans.tipo,
      valor: Number(newTrans.valor),
      data: formattedDate,
      status: newTrans.status,
    };

    // In a real implementation, this would call an API to create the transaction
    // For now, we'll just show a message that this requires API implementation
    alert('Funcionalidade de lançamentos financeiros requer implementação de endpoint API para transações financeiras');

    setShowModal(false);
    setNewTrans({ descricao: '', categoria: 'Serviços', tipo: 'receita', valor: 0.0, status: 'concluido' });
  };

  const content = (
    <div style={{ flex: 1, minWidth: 0, background: tokens.color.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: 'white', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <button onClick={() => onNav('dashboard')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 4 }}>
              {Icons.chevL}
            </button>
          )}
          <div>
            <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.25rem', color: tokens.color.text, margin: 0 }}>Gestão Financeira</h2>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>Monitore receitas, despesas e fluxo de caixa de sua oficina.</p>
          </div>
        </div>
        <button
          onClick={onNewOS}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#CC1400', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <span style={{ display: 'flex' }}></span>Nova OS
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: tokens.color.muted }}>Carregando dados financeiros...</p>
        </div>
      )}

      {/* KPI Cards Row */}
      {!loading && (
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
      )}

      {/* Transaction List Info */}
      {!loading && (
        <Card style={{ padding: '16px 20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Nota sobre Lançamentos Financeiros</span>
            <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>Dados derivados de ordens de serviço</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ color: tokens.color.text, lineHeight: 1.6 }}>
              Esta página mostra dados financeiros derivados das ordens de serviço reais.
              Para um controle financeiro detalhado com lançamentos individuais de receitas e despesas,
              seria necessário implementar endpoints API específicos para transações financeiras.
            </p>
            <p style={{ color: tokens.color.muted, fontSize: '0.75rem', marginTop: 12 }}>
              Os valores de receitas, custos e lucro abaixo são calculados com base nas ordens de serviço finalizadas.
            </p>
          </div>
        </Card>
      )}

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

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="financeiro" onNav={onNav} onNewOS={onNewOS} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="financeiro" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{content}</main>
    </div>
  );
}
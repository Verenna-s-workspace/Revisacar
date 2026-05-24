import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';

interface EstoqueItem {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  minimo: number;
  preco: number;
  localizacao: string;
}

const MOCK_ESTOQUE: EstoqueItem[] = [
  { id: '1', nome: 'Óleo Sintético 5W30 Mobil', categoria: 'Lubrificantes', quantidade: 24, minimo: 10, preco: 58.90, localizacao: 'Prateleira A1' },
  { id: '2', nome: 'Filtro de Óleo Civic (2012-2021)', categoria: 'Filtros', quantidade: 3, minimo: 5, preco: 35.00, localizacao: 'Prateleira A3' },
  { id: '3', nome: 'Pastilha de Freio Dianteira Civic', categoria: 'Freios', quantidade: 2, minimo: 4, preco: 189.00, localizacao: 'Prateleira B2' },
  { id: '4', nome: 'Filtro de Ar Motor Corolla', categoria: 'Filtros', quantidade: 8, minimo: 4, preco: 45.00, localizacao: 'Prateleira A4' },
  { id: '5', nome: 'Fluido de Freio Bosch DOT 4', categoria: 'Fluidos', quantidade: 15, minimo: 6, preco: 28.50, localizacao: 'Armário C1' },
  { id: '6', nome: 'Palheta Limpador Dyna 26"/14"', categoria: 'Acessórios', quantidade: 4, minimo: 5, preco: 79.90, localizacao: 'Prateleira D3' },
];

export function EstoquePage({ isMobile }: { isMobile: boolean }) {
  const [itens, setItens] = useState<EstoqueItem[]>(MOCK_ESTOQUE);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'baixo' | 'ok'>('all');
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState({ nome: '', categoria: 'Lubrificantes', quantidade: 10, minimo: 5, preco: 0.0, localizacao: '' });

  const filtered = itens.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.categoria.toLowerCase().includes(search.toLowerCase()) ||
      item.localizacao.toLowerCase().includes(search.toLowerCase());

    const isLow = item.quantidade <= item.minimo;
    const matchesFilter = filterType === 'all' || 
      (filterType === 'baixo' && isLow) || 
      (filterType === 'ok' && !isLow);

    return matchesSearch && matchesFilter;
  });

  const lowStockCount = itens.filter(i => i.quantidade <= i.minimo).length;

  const handleQtyChange = (id: string, delta: number) => {
    setItens(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantidade: Math.max(0, item.quantidade + delta) };
      }
      return item;
    }));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.nome || newItem.preco <= 0) return;
    const item: EstoqueItem = {
      id: String(itens.length + 1),
      nome: newItem.nome,
      categoria: newItem.categoria,
      quantidade: Number(newItem.quantidade),
      minimo: Number(newItem.minimo),
      preco: Number(newItem.preco),
      localizacao: newItem.localizacao || 'Sem prateleira',
    };
    setItens([item, ...itens]);
    setShowModal(false);
    setNewItem({ nome: '', categoria: 'Lubrificantes', quantidade: 10, minimo: 5, preco: 0.0, localizacao: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Controle de Estoque</h2>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Gerencie as peças e produtos disponíveis para os serviços.</p>
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
          {Icons.plus} Novo Item
        </button>
      </div>

      {/* Warning Alert Banner for Low Stock */}
      {lowStockCount > 0 && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--color-crit-bg)',
          border: '1px solid var(--color-crit-border)',
          borderRadius: 12,
          color: 'var(--color-crit)',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span style={{ display: 'flex' }}>{Icons.alert}</span>
          <div>
            Atenção: <strong>{lowStockCount}</strong> itens estão com a quantidade em estoque **abaixo do limite mínimo**.
          </div>
        </div>
      )}

      {/* Filter and Search controls */}
      <Card style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: tokens.color.muted, display: 'flex' }}>
              {Icons.search}
            </span>
            <input
              type="text"
              placeholder="Buscar item por nome, categoria, prateleira..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px 11px 40px',
                background: tokens.color.bg,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 10,
                color: tokens.color.text,
                fontSize: '0.875rem',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '8px 14px',
                background: filterType === 'all' ? 'var(--color-ferrari-glow)' : 'transparent',
                color: filterType === 'all' ? 'var(--color-ferrari)' : tokens.color.textSecond,
                border: `1px solid ${filterType === 'all' ? 'var(--color-ferrari)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Todos ({itens.length})
            </button>
            <button
              onClick={() => setFilterType('baixo')}
              style={{
                padding: '8px 14px',
                background: filterType === 'baixo' ? 'var(--color-crit-bg)' : 'transparent',
                color: filterType === 'baixo' ? 'var(--color-crit)' : tokens.color.textSecond,
                border: `1px solid ${filterType === 'baixo' ? 'var(--color-crit)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Estoque Baixo ({lowStockCount})
            </button>
            <button
              onClick={() => setFilterType('ok')}
              style={{
                padding: '8px 14px',
                background: filterType === 'ok' ? 'var(--color-ok-bg)' : 'transparent',
                color: filterType === 'ok' ? 'var(--color-ok)' : tokens.color.textSecond,
                border: `1px solid ${filterType === 'ok' ? 'var(--color-ok)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Estoque Saudável ({itens.length - lowStockCount})
            </button>
          </div>
        </div>
      </Card>

      {/* Table list */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.color.border}`, background: tokens.color.surfaceHigh }}>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Item / Descrição</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Categoria</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Localização</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'right' }}>Preço Unitário</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'center', width: 140 }}>Qtd. em Estoque</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'right' }}>Ações Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = item.quantidade <= item.minimo;
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: `1px solid ${tokens.color.border}`,
                      transition: 'var(--transition-fast)',
                    }}
                    className="checklist-item"
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.color.text }}>{item.nome}</div>
                      <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>ID: #{item.id}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.84rem', color: tokens.color.textSecond }}>
                      {item.categoria}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '0.84rem', color: tokens.color.muted }}>
                      {item.localizacao}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: tokens.color.text }}>
                      R$ {item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <button
                          onClick={() => handleQtyChange(item.id, -1)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: tokens.color.surfaceHigh,
                            border: `1px solid ${tokens.color.border}`,
                            color: tokens.color.text,
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text, width: 30, textAlign: 'center' }}>
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => handleQtyChange(item.id, 1)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: tokens.color.surfaceHigh,
                            border: `1px solid ${tokens.color.border}`,
                            color: tokens.color.text,
                            cursor: 'pointer',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: isLow ? 'var(--color-crit-bg)' : 'var(--color-ok-bg)',
                        color: isLow ? 'var(--color-crit)' : 'var(--color-ok)',
                        border: `1px solid ${isLow ? 'var(--color-crit-border)' : 'var(--color-ok-border)'}`
                      }}>
                        {isLow ? 'Baixo Nível' : 'Suficiente'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleQtyChange(item.id, 10)}
                        style={{
                          padding: '6px 10px',
                          background: tokens.color.surfaceHigh,
                          border: `1px solid ${tokens.color.border}`,
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          color: tokens.color.textSecond,
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        +10 Unid.
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: tokens.color.muted, fontSize: '0.85rem' }}>
                    Nenhum item do estoque encontrado com esse critério.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Stock Item Modal */}
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Adicionar Item ao Estoque</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>NOME DO PRODUTO / PEÇA *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Correia Dentada Civic"
                  value={newItem.nome}
                  onChange={e => setNewItem({ ...newItem, nome: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>CATEGORIA</label>
                  <select
                    value={newItem.categoria}
                    onChange={e => setNewItem({ ...newItem, categoria: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  >
                    <option>Lubrificantes</option>
                    <option>Filtros</option>
                    <option>Freios</option>
                    <option>Fluidos</option>
                    <option>Suspensão</option>
                    <option>Acessórios</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>PREÇO UNITÁRIO (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItem.preco || ''}
                    onChange={e => setNewItem({ ...newItem, preco: Number(e.target.value) })}
                    placeholder="Ex: 58.90"
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>QTD INICIAL</label>
                  <input
                    type="number"
                    value={newItem.quantidade}
                    onChange={e => setNewItem({ ...newItem, quantidade: Number(e.target.value) })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>MÍNIMO ALERTA</label>
                  <input
                    type="number"
                    value={newItem.minimo}
                    onChange={e => setNewItem({ ...newItem, minimo: Number(e.target.value) })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>LOCALIZAÇÃO NA OFICINA</label>
                <input
                  type="text"
                  placeholder="Ex: Prateleira B3"
                  value={newItem.localizacao}
                  onChange={e => setNewItem({ ...newItem, localizacao: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
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
                  Adicionar Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

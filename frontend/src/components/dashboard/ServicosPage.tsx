import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';
import { useServicos } from '../../hooks/useServicos';
import type { ServicoItem } from '../../types/servico';

export function ServicosPage({ isMobile }: { isMobile: boolean }) {
  const { servicos, loading, usingApi } = useServicos();
  const [showModal, setShowModal] = useState(false);
  const [newSvc, setNewSvc] = useState({ nome: '', categoria: 'Geral', preco: 0.0, duracao: '1h', descricao: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSvc.nome || newSvc.preco <= 0) return;

    try {
      // Use the API to create the service
      const novoServico = await api.criarServico({
        nome: newSvc.nome,
        categoria: newSvc.categoria,
        preco: newSvc.preco,
        duracao: newSvc.duracao,
        descricao: newSvc.descricao,
      });

      // The hook will automatically update the servicos state via its internal mechanism
      // We just need to reset the form
      setShowModal(false);
      setNewSvc({ nome: '', categoria: 'Geral', preco: 0.0, duracao: '1h', descricao: '' });
    } catch (error) {
      console.error('Failed to create service:', error);
      // In a real app, we might show an error message to the user
      setShowModal(false);
      setNewSvc({ nome: '', categoria: 'Geral', preco: 0.0, duracao: '1h', descricao: '' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Catálogo de Serviços</h2>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Cadastre os serviços e preços padrão oferecidos pela oficina.</p>
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
          {Icons.plus} Adicionar Serviço
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: tokens.color.muted }}>Carregando serviços...</p>
        </div>
      )}

      {/* Services List */}
      {!loading && (
        <>
          {/* Grid of services */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {servicos.length > 0 ? (
              servicos.map(svc => (
                <Card key={svc.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{
                        padding: '3px 8px',
                        background: tokens.color.surfaceHigh,
                        color: tokens.color.textSecond,
                        borderRadius: 6,
                        fontSize: '0.68rem',
                        fontWeight: 700
                      }}>
                        {svc.categoria}
                      </span>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, margin: '8px 0 0' }}>{svc.nome}</h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-ferrari)' }}>
                        R$ {svc.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: tokens.color.muted, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                        Tempo: {svc.duracao}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: tokens.color.textSecond, lineHeight: 1.4, margin: 0 }}>
                    {svc.descricao}
                  </p>
                </Card>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ color: tokens.color.muted }}>Nenhum serviço cadastrado</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Adicionar Serviço</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>NOME DO SERVIÇO *</label>
                <input
                  type="text"
                  required
                  value={newSvc.nome}
                  onChange={e => setNewSvc({ ...newSvc, nome: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>CATEGORIA</label>
                  <select
                    value={newSvc.categoria}
                    onChange={e => setNewSvc({ ...newSvc, categoria: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  >
                    <option>Lubrificantes</option>
                    <option>Freios</option>
                    <option>Suspensão</option>
                    <option>Climatização</option>
                    <option>Eletrônica</option>
                    <option>Geral</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>DURAÇÃO ESTIMADA</label>
                  <input
                    type="text"
                    required
                    value={newSvc.duracao}
                    onChange={e => setNewSvc({ ...newSvc, duracao: e.target.value })}
                    placeholder="Ex: 1h 30min"
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>PREÇO COBRADO (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newSvc.preco || ''}
                  onChange={e => setNewSvc({ ...newSvc, preco: Number(e.target.value) })}
                  placeholder="Ex: 250.00"
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>DESCRIÇÃO DETALHADA</label>
                <textarea
                  value={newSvc.descricao}
                  onChange={e => setNewSvc({ ...newSvc, descricao: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem', height: 80, resize: 'none' }}
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
                  Salvar Serviço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

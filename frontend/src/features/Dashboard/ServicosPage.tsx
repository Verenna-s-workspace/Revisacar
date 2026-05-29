import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';

interface ServicoItem {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  duracao: string;
  descricao: string;
}

const MOCK_SERVICOS: ServicoItem[] = [
  { id: '1', nome: 'Troca de Óleo e Filtro', categoria: 'Lubrificantes', preco: 180.00, duracao: '45 min', descricao: 'Substituição do óleo do motor e do respectivo filtro de óleo.' },
  { id: '2', nome: 'Revisão do Sistema de Freio', categoria: 'Freios', preco: 320.00, duracao: '1h 30min', descricao: 'Inspeção de pastilhas, discos, fluido, sapatas e tubulação.' },
  { id: '3', nome: 'Alinhamento 3D + Balanceamento', categoria: 'Suspensão', preco: 150.00, duracao: '1h', descricao: 'Ajuste de convergência/divergência e balanceamento das 4 rodas.' },
  { id: '4', nome: 'Higienização de Ar Condicionado', categoria: 'Climatização', preco: 280.00, duracao: '1h', descricao: 'Limpeza dos dutos, troca do filtro de cabine e aplicação de bactericida.' },
  { id: '5', nome: 'Diagnóstico por Scanner Injeção', categoria: 'Eletrônica', preco: 200.00, duracao: '45 min', descricao: 'Leitura de códigos de falha e parâmetros de sensores por scanner OBD2.' },
  { id: '6', nome: 'Revisão Geral Preventiva', categoria: 'Geral', preco: 800.00, duracao: '3h', descricao: 'Checklist completo de mais de 60 itens de motor, suspensão, freios e elétrica.' },
];

export function ServicosPage({ isMobile }: { isMobile: boolean }) {
  const [servicos, setServicos] = useState<ServicoItem[]>(MOCK_SERVICOS);
  const [showModal, setShowModal] = useState(false);
  const [newSvc, setNewSvc] = useState({ nome: '', categoria: 'Geral', preco: 0.0, duracao: '1h', descricao: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSvc.nome || newSvc.preco <= 0) return;
    const item: ServicoItem = {
      id: String(servicos.length + 1),
      nome: newSvc.nome,
      categoria: newSvc.categoria,
      preco: Number(newSvc.preco),
      duracao: newSvc.duracao,
      descricao: newSvc.descricao,
    };
    setServicos([...servicos, item]);
    setShowModal(false);
    setNewSvc({ nome: '', categoria: 'Geral', preco: 0.0, duracao: '1h', descricao: '' });
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

      {/* Grid of services */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {servicos.map(svc => (
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
        ))}
      </div>

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

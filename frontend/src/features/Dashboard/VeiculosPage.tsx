import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';

interface Veiculo {
  id: string;
  modelo: string;
  marca: string;
  placa: string;
  cor: string;
  ano: number;
  proprietario: string;
  status: 'em_revisao' | 'aprovado' | 'aguardando_peca';
  combustivel: string;
}

const MOCK_VEICULOS: Veiculo[] = [
  { id: '1', modelo: 'Civic LXR 2.0', marca: 'Honda', placa: 'PXP-4B22', cor: 'Preto Cristal', ano: 2016, proprietario: 'Lucas Andrelo', status: 'em_revisao', combustivel: 'Flex' },
  { id: '2', modelo: 'Corolla XEi 2.0', marca: 'Toyota', placa: 'ABC-1234', cor: 'Prata Melfi', ano: 2020, proprietario: 'Maria Silva', status: 'aprovado', combustivel: 'Flex' },
  { id: '3', modelo: 'Golf GTI 2.0', marca: 'Volkswagen', placa: 'XYZ-9876', cor: 'Vermelho Tornado', ano: 2018, proprietario: 'João Santos', status: 'aguardando_peca', combustivel: 'Gasolina' },
  { id: '4', modelo: 'Uno Mille 1.0', marca: 'Fiat', placa: 'KAS-4012', cor: 'Branco Banchisa', ano: 2012, proprietario: 'Ana Costa', status: 'aprovado', combustivel: 'Etanol' },
  { id: '5', modelo: 'Onix LTZ 1.4', marca: 'Chevrolet', placa: 'ONX-1020', cor: 'Cinza Graphite', ano: 2019, proprietario: 'Roberto Souza', status: 'em_revisao', combustivel: 'Flex' },
];

export function VeiculosPage({ onNewOS, isMobile }: { onNewOS: () => void; isMobile: boolean }) {
  const [veiculos, setVeiculos] = useState<Veiculo[]>(MOCK_VEICULOS);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [newVeiculo, setNewVeiculo] = useState({ modelo: '', marca: '', placa: '', cor: '', ano: new Date().getFullYear(), proprietario: '', status: 'em_revisao', combustivel: 'Flex' });

  const filtered = veiculos.filter(v => {
    const matchesSearch = v.modelo.toLowerCase().includes(search.toLowerCase()) ||
      v.placa.toLowerCase().includes(search.toLowerCase()) ||
      v.proprietario.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVeiculo.modelo || !newVeiculo.placa || !newVeiculo.proprietario) return;
    const car: Veiculo = {
      id: String(veiculos.length + 1),
      modelo: newVeiculo.modelo,
      marca: newVeiculo.marca || 'N/A',
      placa: newVeiculo.placa.toUpperCase(),
      cor: newVeiculo.cor || 'N/A',
      ano: Number(newVeiculo.ano),
      proprietario: newVeiculo.proprietario,
      status: newVeiculo.status as any,
      combustivel: newVeiculo.combustivel,
    };
    setVeiculos([car, ...veiculos]);
    setShowModal(false);
    setNewVeiculo({ modelo: '', marca: '', placa: '', cor: '', ano: new Date().getFullYear(), proprietario: '', status: 'em_revisao', combustivel: 'Flex' });
  };

  const getStatusBadge = (status: Veiculo['status']) => {
    const configs = {
      em_revisao: { label: 'Em Revisão', bg: 'var(--color-warn-bg)', color: 'var(--color-warn)', border: 'var(--color-warn-border)' },
      aprovado: { label: 'Aprovado', bg: 'var(--color-ok-bg)', color: 'var(--color-ok)', border: 'var(--color-ok-border)' },
      aguardando_peca: { label: 'Aguardando Peça', bg: 'var(--color-crit-bg)', color: 'var(--color-crit)', border: 'var(--color-crit-border)' },
    };
    const c = configs[status];
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: '0.72rem',
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`
      }}>
        {c.label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Frotas & Veículos</h2>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Visualize e pesquise os carros em manutenção ou liberados.</p>
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
          {Icons.plus} Adicionar Veículo
        </button>
      </div>

      {/* Filter and Search controls */}
      <Card style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: tokens.color.muted, display: 'flex' }}>
              {Icons.search}
            </span>
            <input
              type="text"
              placeholder="Buscar por placa, modelo ou proprietário..."
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
              onClick={() => setFilterStatus('all')}
              style={{
                padding: '8px 14px',
                background: filterStatus === 'all' ? 'var(--color-ferrari-glow)' : 'transparent',
                color: filterStatus === 'all' ? 'var(--color-ferrari)' : tokens.color.textSecond,
                border: `1px solid ${filterStatus === 'all' ? 'var(--color-ferrari)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('em_revisao')}
              style={{
                padding: '8px 14px',
                background: filterStatus === 'em_revisao' ? 'var(--color-warn-bg)' : 'transparent',
                color: filterStatus === 'em_revisao' ? 'var(--color-warn)' : tokens.color.textSecond,
                border: `1px solid ${filterStatus === 'em_revisao' ? 'var(--color-warn)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Em Revisão
            </button>
            <button
              onClick={() => setFilterStatus('aprovado')}
              style={{
                padding: '8px 14px',
                background: filterStatus === 'aprovado' ? 'var(--color-ok-bg)' : 'transparent',
                color: filterStatus === 'aprovado' ? 'var(--color-ok)' : tokens.color.textSecond,
                border: `1px solid ${filterStatus === 'aprovado' ? 'var(--color-ok)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Aprovado
            </button>
            <button
              onClick={() => setFilterStatus('aguardando_peca')}
              style={{
                padding: '8px 14px',
                background: filterStatus === 'aguardando_peca' ? 'var(--color-crit-bg)' : 'transparent',
                color: filterStatus === 'aguardando_peca' ? 'var(--color-crit)' : tokens.color.textSecond,
                border: `1px solid ${filterStatus === 'aguardando_peca' ? 'var(--color-crit)' : tokens.color.border}`,
                borderRadius: 8,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Aguardando Peça
            </button>
          </div>
        </div>
      </Card>

      {/* Grid of Vehicles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
        {filtered.map(car => (
          <Card key={car.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.car}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: tokens.color.muted }}>{car.marca}</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, margin: '4px 0 0' }}>{car.modelo}</h3>
              </div>
              {getStatusBadge(car.status)}
            </div>

            <div style={{ height: 1, background: tokens.color.border }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: tokens.color.muted, textTransform: 'uppercase', fontWeight: 600 }}>PLACA</div>
                <div style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  background: tokens.color.surfaceHigh,
                  border: `1px solid ${tokens.color.borderHigh}`,
                  borderRadius: 4,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: tokens.color.text,
                  letterSpacing: '0.05em',
                  marginTop: 2
                }}>
                  {car.placa}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: tokens.color.muted, textTransform: 'uppercase', fontWeight: 600 }}>PROPRIETÁRIO</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.color.textSecond, marginTop: 4 }}>{car.proprietario}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: tokens.color.muted, textTransform: 'uppercase', fontWeight: 600 }}>COR / ANO</div>
                <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond, marginTop: 4 }}>{car.cor} • {car.ano}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: tokens.color.muted, textTransform: 'uppercase', fontWeight: 600 }}>COMBUSTÍVEL</div>
                <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond, marginTop: 4 }}>{car.combustivel}</div>
              </div>
            </div>

            <div style={{ height: 1, background: tokens.color.border }} />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onNewOS}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  background: 'transparent',
                  border: `1px solid var(--color-ferrari)`,
                  color: 'var(--color-ferrari)',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                Nova Inspeção
              </button>
              <button
                style={{
                  padding: '9px 12px',
                  background: tokens.color.surfaceHigh,
                  border: 'none',
                  color: tokens.color.textSecond,
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {Icons.cog}
              </button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: tokens.color.muted, fontSize: '0.85rem' }}>
            Nenhum veículo encontrado com esse critério.
          </div>
        )}
      </div>

      {/* Add Vehicle Modal */}
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Cadastrar Veículo</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>MARCA *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Honda"
                    value={newVeiculo.marca}
                    onChange={e => setNewVeiculo({ ...newVeiculo, marca: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>MODELO *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Civic LXR 2.0"
                    value={newVeiculo.modelo}
                    onChange={e => setNewVeiculo({ ...newVeiculo, modelo: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>PLACA *</label>
                  <input
                    type="text"
                    required
                    placeholder="PXP-4B22"
                    value={newVeiculo.placa}
                    onChange={e => setNewVeiculo({ ...newVeiculo, placa: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>COR</label>
                  <input
                    type="text"
                    placeholder="Ex: Preto"
                    value={newVeiculo.cor}
                    onChange={e => setNewVeiculo({ ...newVeiculo, cor: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>ANO</label>
                  <input
                    type="number"
                    value={newVeiculo.ano}
                    onChange={e => setNewVeiculo({ ...newVeiculo, ano: Number(e.target.value) })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>COMBUSTÍVEL</label>
                  <select
                    value={newVeiculo.combustivel}
                    onChange={e => setNewVeiculo({ ...newVeiculo, combustivel: e.target.value })}
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  >
                    <option>Flex</option>
                    <option>Gasolina</option>
                    <option>Etanol</option>
                    <option>Diesel</option>
                    <option>Híbrido</option>
                    <option>Elétrico</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>PROPRIETÁRIO (CLIENTE) *</label>
                <input
                  type="text"
                  required
                  placeholder="Lucas Andrelo"
                  value={newVeiculo.proprietario}
                  onChange={e => setNewVeiculo({ ...newVeiculo, proprietario: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>STATUS INICIAL</label>
                <select
                  value={newVeiculo.status}
                  onChange={e => setNewVeiculo({ ...newVeiculo, status: e.target.value as any })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                >
                  <option value="em_revisao">Em Revisão</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="aguardando_peca">Aguardando Peça</option>
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
                  Salvar Veículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { Card } from './Primitives';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  veiculo: string;
  status: 'ativo' | 'inativo';
  ordensCount: number;
}

const MOCK_CLIENTES: Cliente[] = [
  { id: '1', nome: 'Lucas Andrelo', telefone: '(11) 98765-4321', email: 'lucas@gmail.com', cpf: '123.456.789-00', veiculo: 'Honda Civic (PXP-4B22)', status: 'ativo', ordensCount: 3 },
  { id: '2', nome: 'Maria Silva', telefone: '(11) 97654-3210', email: 'maria.silva@outlook.com', cpf: '234.567.890-11', veiculo: 'Toyota Corolla (ABC-1234)', status: 'ativo', ordensCount: 1 },
  { id: '3', nome: 'João Santos', telefone: '(21) 96543-2109', email: 'joao.santos@yahoo.com', cpf: '345.678.901-22', veiculo: 'VW Golf (XYZ-9876)', status: 'inativo', ordensCount: 0 },
  { id: '4', nome: 'Ana Costa', telefone: '(31) 95432-1098', email: 'ana.costa@hotmail.com', cpf: '456.789.012-33', veiculo: 'Fiat Uno (KAS-4012)', status: 'ativo', ordensCount: 2 },
  { id: '5', nome: 'Roberto Souza', telefone: '(19) 94321-0987', email: 'roberto@souza.com', cpf: '567.890.123-44', veiculo: 'Chevrolet Onix (ONX-1020)', status: 'ativo', ordensCount: 4 },
];

export function ClientesPage({ onNewOS, isMobile }: { onNewOS: () => void; isMobile: boolean }) {
  const [clientes, setClientes] = useState<Cliente[]>(MOCK_CLIENTES);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newCliente, setNewCliente] = useState({ nome: '', telefone: '', email: '', cpf: '', veiculo: '' });

  const filtered = clientes.filter(c => 
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search) ||
    c.veiculo.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliente.nome || !newCliente.telefone) return;
    const client: Cliente = {
      id: String(clientes.length + 1),
      nome: newCliente.nome,
      telefone: newCliente.telefone,
      email: newCliente.email || 'N/A',
      cpf: newCliente.cpf || 'N/A',
      veiculo: newCliente.veiculo || 'Não Cadastrado',
      status: 'ativo',
      ordensCount: 0,
    };
    setClientes([client, ...clientes]);
    setShowModal(false);
    setNewCliente({ nome: '', telefone: '', email: '', cpf: '', veiculo: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: tokens.color.text, margin: 0 }}>Gestão de Clientes</h2>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '2px 0 0' }}>Cadastre e gerencie a carteira de clientes de sua oficina.</p>
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
          {Icons.plus} Novo Cliente
        </button>
      </div>

      {/* Search and Stats Grid */}
      <Card style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: tokens.color.muted, display: 'flex' }}>
              {Icons.search}
            </span>
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou veículo..."
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
                transition: 'var(--transition-fast)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: '0.82rem', color: tokens.color.muted, whiteSpace: 'nowrap' }}>
            <strong>{filtered.length}</strong> clientes encontrados
          </div>
        </div>
      </Card>

      {/* Clientes Table/List */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.color.border}`, background: tokens.color.surfaceHigh }}>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Cliente</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Contato</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>CPF</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Principal Veículo</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'center' }}>Ordens</th>
                <th style={{ padding: '14px 20px', fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cliente => (
                <tr
                  key={cliente.id}
                  style={{
                    borderBottom: `1px solid ${tokens.color.border}`,
                    transition: 'var(--transition-fast)',
                    cursor: 'pointer',
                  }}
                  className="checklist-item"
                >
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--color-ferrari-glow)', color: 'var(--color-ferrari)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                        {cliente.nome.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.color.text }}>{cliente.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>ID: #{cliente.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '0.84rem', color: tokens.color.text }}>{cliente.telefone}</div>
                    <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>{cliente.email}</div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '0.84rem', color: tokens.color.textSecond }}>
                    {cliente.cpf}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: tokens.color.text }}>
                      <span style={{ color: tokens.color.muted }}>{Icons.car}</span>
                      {cliente.veiculo}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: cliente.status === 'ativo' ? 'var(--color-ok-bg)' : 'var(--color-na-bg)',
                      color: cliente.status === 'ativo' ? 'var(--color-ok)' : 'var(--color-na)',
                      border: `1px solid ${cliente.status === 'ativo' ? 'var(--color-ok-border)' : 'var(--color-na-border)'}`
                    }}>
                      {cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: tokens.color.text }}>
                    {cliente.ordensCount}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNewOS(); }}
                        title="Nova OS"
                        style={{ border: 'none', background: 'transparent', padding: 6, cursor: 'pointer', color: 'var(--color-ferrari)', display: 'flex' }}
                      >
                        {Icons.plus}
                      </button>
                      <button
                        title="Detalhes"
                        style={{ border: 'none', background: 'transparent', padding: 6, cursor: 'pointer', color: tokens.color.muted, display: 'flex' }}
                      >
                        {Icons.arrow}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: tokens.color.muted, fontSize: '0.85rem' }}>
                    Nenhum cliente cadastrado com esse critério.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Novo Cliente */}
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Adicionar Novo Cliente</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>NOME COMPLETO *</label>
                <input
                  type="text"
                  required
                  value={newCliente.nome}
                  onChange={e => setNewCliente({ ...newCliente, nome: e.target.value })}
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>TELEFONE *</label>
                  <input
                    type="text"
                    required
                    value={newCliente.telefone}
                    onChange={e => setNewCliente({ ...newCliente, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>CPF</label>
                  <input
                    type="text"
                    value={newCliente.cpf}
                    onChange={e => setNewCliente({ ...newCliente, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>EMAIL</label>
                <input
                  type="email"
                  value={newCliente.email}
                  onChange={e => setNewCliente({ ...newCliente, email: e.target.value })}
                  placeholder="exemplo@gmail.com"
                  style={{ width: '100%', padding: 10, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 8, color: tokens.color.text, fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>VEÍCULO PRINCIPAL</label>
                <input
                  type="text"
                  value={newCliente.veiculo}
                  onChange={e => setNewCliente({ ...newCliente, veiculo: e.target.value })}
                  placeholder="Modelo e Placa (opcional)"
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
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

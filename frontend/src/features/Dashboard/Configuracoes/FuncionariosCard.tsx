import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Card } from '../Primitives';
import { api } from '../../../utils/api';
import { usePermissions } from '../../../hooks/usePermissions.tsx';
import type { Funcionario } from '../../../types';

const CARGO_LABEL: Record<string, string> = {
  gerente: 'Gerente',
  mecanico: 'Mecânico',
  atendente: 'Atendente',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: tokens.color.bg,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  color: tokens.color.text,
  fontSize: '0.875rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: tokens.color.textSecond,
  marginBottom: 5,
};

const FORM_INICIAL = { nome: '', email: '', pin: '', cargo: 'atendente' as const };

export function FuncionariosCard({ isMobile }: { isMobile: boolean }) {
  const { can } = usePermissions();
  const podeGerenciar = can('funcionarios.gerenciar');

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; email: string; pin: string; cargo: string }>(FORM_INICIAL);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    api.listarFuncionarios()
      .then((data: Funcionario[]) => setFuncionarios(data))
      .catch(() => setErro('Não foi possível carregar os funcionários.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (podeGerenciar) carregar();
  }, [podeGerenciar, carregar]);

  // Esconder a seção inteira é só UX — quem realmente barra o acesso é o
  // require_permission("funcionarios.gerenciar") no backend.
  if (!podeGerenciar) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.criarFuncionario(novo);
      setShowModal(false);
      setNovo(FORM_INICIAL);
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message.replace(/"/g, '') : 'Erro ao cadastrar funcionário');
    } finally {
      setSalvando(false);
    }
  };

  const handleCargoChange = async (id: string, cargo: string) => {
    const anterior = funcionarios;
    setFuncionarios(fs => fs.map(f => (f.id === id ? { ...f, cargo: cargo as Funcionario['cargo'] } : f)));
    try {
      await api.atualizarFuncionario(id, { cargo });
    } catch {
      setFuncionarios(anterior);
      setErro('Não foi possível atualizar o cargo. Tente de novo.');
    }
  };

  const handleToggleAtivo = async (f: Funcionario) => {
    const anterior = funcionarios;
    setFuncionarios(fs => fs.map(x => (x.id === f.id ? { ...x, ativo: !x.ativo } : x)));
    try {
      await api.atualizarFuncionario(f.id, { ativo: !f.ativo });
    } catch {
      setFuncionarios(anterior);
      setErro('Não foi possível atualizar o acesso. Tente de novo.');
    }
  };

  const handleRemover = async (id: string) => {
    if (!window.confirm('Remover o acesso deste funcionário? Essa ação não pode ser desfeita.')) return;
    const anterior = funcionarios;
    setFuncionarios(fs => fs.filter(f => f.id !== id));
    try {
      await api.removerFuncionario(id);
    } catch {
      setFuncionarios(anterior);
      setErro('Não foi possível remover o funcionário. Tente de novo.');
    }
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${tokens.color.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.user}</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Funcionários e Cargos</div>
            <div style={{ fontSize: '0.74rem', color: tokens.color.muted }}>Controla quem acessa o quê no sistema</div>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            background: 'var(--color-ferrari)',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            width: isMobile ? '100%' : 'auto',
            justifyContent: 'center',
          }}
        >
          {Icons.plus} Novo Funcionário
        </button>
      </div>

      {erro && (
        <div style={{
          margin: '14px 20px 0',
          padding: '10px 14px',
          background: 'var(--color-crit-bg)',
          color: 'var(--color-crit)',
          border: '1px solid var(--color-crit-border)',
          borderRadius: 8,
          fontSize: '0.8rem',
          fontWeight: 600,
        }}>
          {erro}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: tokens.color.muted, fontSize: '0.85rem' }}>
          Carregando funcionários…
        </div>
      ) : funcionarios.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: tokens.color.muted, fontSize: '0.85rem' }}>
          Nenhum funcionário cadastrado ainda.
        </div>
      ) : (
        <div>
          {funcionarios.map(f => (
            <div
              key={f.id}
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${tokens.color.border}`,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: f.ativo ? 1 : 0.55,
              }}
            >
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: tokens.color.text }}>{f.nome}</div>
                <div style={{ fontSize: '0.74rem', color: tokens.color.muted }}>{f.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                <select
                  value={f.cargo}
                  onChange={e => handleCargoChange(f.id, e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '7px 8px', fontSize: '0.8rem' }}
                >
                  <option value="gerente">{CARGO_LABEL.gerente}</option>
                  <option value="mecanico">{CARGO_LABEL.mecanico}</option>
                  <option value="atendente">{CARGO_LABEL.atendente}</option>
                </select>
                <button
                  onClick={() => handleToggleAtivo(f)}
                  title={f.ativo ? 'Clique para desativar o acesso' : 'Clique para reativar o acesso'}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: f.ativo ? 'var(--color-ok-bg)' : tokens.color.surfaceHigh,
                    color: f.ativo ? 'var(--color-ok)' : tokens.color.muted,
                    border: `1px solid ${f.ativo ? 'var(--color-ok-border)' : tokens.color.border}`,
                  }}
                >
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  onClick={() => handleRemover(f.id)}
                  title="Remover funcionário"
                  style={{
                    padding: 7,
                    borderRadius: 8,
                    background: 'transparent',
                    color: tokens.color.muted,
                    border: `1px solid ${tokens.color.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                >
                  {Icons.trash}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
            maxWidth: 440,
            border: `1px solid ${tokens.color.border}`,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 24px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Novo Funcionário</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: tokens.color.muted }}>×</button>
            </div>
            <form onSubmit={handleAdd} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>NOME *</label>
                <input
                  type="text"
                  required
                  value={novo.nome}
                  onChange={e => setNovo({ ...novo, nome: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>EMAIL DE LOGIN *</label>
                <input
                  type="email"
                  required
                  value={novo.email}
                  onChange={e => setNovo({ ...novo, email: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>PIN INICIAL (6 dígitos) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={novo.pin}
                  onChange={e => setNovo({ ...novo, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  style={{ ...inputStyle, letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }}
                />
                <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 4 }}>
                  O funcionário usa esse PIN pra entrar. Ele pode trocar depois em "Esqueci meu PIN".
                </div>
              </div>
              <div>
                <label style={labelStyle}>CARGO</label>
                <select
                  value={novo.cargo}
                  onChange={e => setNovo({ ...novo, cargo: e.target.value })}
                  style={inputStyle}
                >
                  <option value="atendente">{CARGO_LABEL.atendente}</option>
                  <option value="mecanico">{CARGO_LABEL.mecanico}</option>
                  <option value="gerente">{CARGO_LABEL.gerente}</option>
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
                  disabled={salvando}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--color-ferrari)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: salvando ? 'default' : 'pointer',
                    opacity: salvando ? 0.7 : 1,
                  }}
                >
                  {salvando ? 'Salvando…' : 'Cadastrar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
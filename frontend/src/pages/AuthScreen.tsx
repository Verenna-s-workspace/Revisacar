import { useState } from 'react';
import { api } from '../utils/api';
import { tokens } from '../constants';
import type { AdminUser } from '../types';

interface AuthScreenProps {
  onAuthenticated: (admin: AdminUser) => void;
}

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedDoc = normalizeDoc(doc).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  const label = mode === 'login' ? 'Login de Administrador' : 'Cadastro de Administrador';

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const payload = {
      nome: nome.trim(),
      doc: normalizeDoc(doc),
      senha,
    };

    try {
      const result = mode === 'login'
        ? await api.loginAdmin({ doc: payload.doc, senha: payload.senha })
        : await api.criarAdmin(payload);

      onAuthenticated(result as AdminUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      setError(message.replace(/\"/g, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tokens.color.bg }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '30px', background: tokens.color.surface, borderRadius: tokens.radius.lg, boxShadow: tokens.shadow.lg }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, color: tokens.color.text }}>RevisaCar</h1>
          <p style={{ margin: '8px 0 0', color: tokens.color.muted }}>{label}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setMode('login')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: tokens.radius.md,
              border: mode === 'login' ? `2px solid ${tokens.color.accent}` : `1px solid ${tokens.color.border}`,
              background: mode === 'login' ? tokens.color.accent : tokens.color.surface,
              color: mode === 'login' ? 'white' : tokens.color.text,
              cursor: 'pointer',
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: tokens.radius.md,
              border: mode === 'register' ? `2px solid ${tokens.color.accent}` : `1px solid ${tokens.color.border}`,
              background: mode === 'register' ? tokens.color.accent : tokens.color.surface,
              color: mode === 'register' ? 'white' : tokens.color.text,
              cursor: 'pointer',
            }}
          >
            Cadastrar
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '14px', borderRadius: tokens.radius.md, background: '#FEE', border: '1px solid #F99', color: '#C33' }}>
            {error}
          </div>
        )}

        {mode === 'register' && (
          <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
            />
          </label>
        )}

        <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
          CNPJ
          <input
            value={formattedDoc}
            onChange={(e) => setDoc(e.target.value)}
            placeholder="00.000.000/0000-00"
            style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '22px', color: tokens.color.textSecond }}>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha segura"
            style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
          />
        </label>

        <button
          type="button"
          disabled={loading}
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: tokens.radius.lg,
            border: 'none',
            background: tokens.color.accent,
            color: 'white',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
        </button>
      </div>
    </div>
  );
}

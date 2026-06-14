import { useState } from 'react';
import { api } from '../utils/api';
import { tokens } from '../constants';
import type { AdminUser, AuthResult } from '../types';

interface AuthScreenProps {
  onAuthenticated: (result: AuthResult) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

const normalizeDoc = (value: string) => value.replace(/\D/g, '').slice(0, 14);

const formatCNPJ = (value: string) => {
  const digits = normalizeDoc(value);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);

  return [
    part1,
    part2 ? `.${part2}` : '',
    part3 ? `.${part3}` : '',
    part4 ? `/${part4}` : '',
    part5 ? `-${part5}` : '',
  ].join('');
};

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const formattedDoc = formatCNPJ(doc);
  const label = mode === 'login' ? 'Login de Administrador' : mode === 'register' ? 'Cadastro de Administrador' : 'Esqueci minha senha';

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Email obrigatório');
          return;
        }
        await api.forgotPassword({ email: email.trim().toLowerCase() });
        setMessage('Se o email existir, você receberá um link de redefinição em breve.');
        return;
      }

      const payload = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        doc: normalizeDoc(doc),
        senha,
      };

      const result = mode === 'login'
        ? await api.loginAdmin({ doc: payload.doc, senha: payload.senha })
        : await api.criarAdmin(payload);

      onAuthenticated(result as { nome: string; doc: string; accessToken: string; refreshToken: string });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      setError(message.replace(/"/g, ''));
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
            onClick={() => { setMode('login'); setError(null); setMessage(null); }}
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
            onClick={() => { setMode('register'); setError(null); setMessage(null); }}
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

        {message && (
          <div style={{ marginBottom: '20px', padding: '14px', borderRadius: tokens.radius.md, background: '#EEF7EF', border: '1px solid #8FCB8D', color: '#1F6A3D' }}>
            {message}
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

        {mode !== 'forgot' && (
          <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
            CNPJ
            <input
              value={formattedDoc}
              onChange={(e) => setDoc(e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
            />
          </label>
        )}

        {mode !== 'forgot' && (
          <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha segura"
              style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
            />
          </label>
        )}

        {mode === 'register' && (
          <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
            />
          </label>
        )}

        {mode === 'forgot' && (
          <label style={{ display: 'block', marginBottom: '22px', color: tokens.color.textSecond }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
            />
          </label>
        )}

        {mode !== 'forgot' && mode === 'login' && (
          <button
            type="button"
            onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
            style={{
              marginBottom: 20,
              background: 'transparent',
              border: 'none',
              color: tokens.color.accent,
              cursor: 'pointer',
              textDecoration: 'underline',
              textAlign: 'left',
            }}
          >
            Esqueci minha senha
          </button>
        )}

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
          {loading ? 'Processando...' : mode === 'forgot' ? 'Enviar link' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
        </button>
      </div>
    </div>
  );
}
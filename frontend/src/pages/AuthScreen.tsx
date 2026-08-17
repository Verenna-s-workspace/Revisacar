import { useState } from 'react';
import { api } from '../utils/api';
import { tokens } from '../constants';
import { Input } from '../components/inputs/input';
import type { AdminUser, AuthResult } from '../types';

interface AuthScreenProps {
  onAuthenticated: (result: AuthResult) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        doc,
        senha,
      };

      const result = mode === 'login'
        ? await api.loginAdmin({ doc: payload.doc, senha: payload.senha })
        : await api.criarAdmin(payload);

      onAuthenticated(result as AuthResult);
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
          <div style={{ marginBottom: '14px' }}>
            <Input name="auth_nome" label="Nome" value={nome} onChangeValue={setNome} placeholder="Seu nome" />
          </div>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginBottom: '14px' }}>
            <Input name="auth_cnpj" type="cpf_cnpj" label="CNPJ" value={doc} onChangeValue={setDoc} placeholder="00.000.000/0000-00" />
          </div>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginBottom: '14px' }}>
            <Input name="auth_senha" type="password" label="Senha" value={senha} onChangeValue={setSenha} placeholder="Senha segura" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
          </div>
        )}

        {mode === 'register' && (
          <div style={{ marginBottom: '14px' }}>
            <Input name="auth_email" type="email" label="Email" value={email} onChangeValue={setEmail} placeholder="seu@email.com" />
          </div>
        )}

        {mode === 'forgot' && (
          <div style={{ marginBottom: '22px' }}>
            <Input name="auth_email_forgot" type="email" label="Email" value={email} onChangeValue={setEmail} placeholder="seu@email.com" />
          </div>
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
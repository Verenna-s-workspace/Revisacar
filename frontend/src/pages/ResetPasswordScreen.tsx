import { useState } from 'react';
import { api } from '../utils/api';
import { tokens } from '../constants';
import type { AuthResult } from '../types';

interface ResetPasswordScreenProps {
  onAuthenticated: (result: AuthResult) => void;
}

export function ResetPasswordScreen({ onAuthenticated }: ResetPasswordScreenProps) {
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!token.trim()) {
      setError('Token obrigatório');
      return;
    }

    if (!senha) {
      setError('Senha obrigatória');
      return;
    }

    if (senha !== confirmacao) {
      setError('As senhas não coincidem');
      return;
    }

    if (senha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      const result = await api.resetPassword({
        token: token.trim(),
        senha,
      });

      // After successful password reset, we can log in automatically
      // or redirect to login screen. Here we'll redirect to login with a message.
      setSuccess('Senha redefinida com sucesso! Você pode fazer login agora.');
      setToken('');
      setSenha('');
      setConfirmacao('');
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
          <p style={{ margin: '8px 0 0', color: tokens.color.muted }}>Redefinição de Senha</p>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '14px', borderRadius: tokens.radius.md, background: '#FEE', border: '1px solid #F99', color: '#C33' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ marginBottom: '20px', padding: '14px', borderRadius: tokens.radius.md, background: '#EEF7EF', border: '1px solid #8FCB8D', color: '#1F6A3D' }}>
            {success}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
          Token de Redefinição
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole o token recebido por email"
            style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
          Nova Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Nova senha"
            style={{ width: '100%', marginTop: '8px', padding: '12px', borderRadius: tokens.radius.md, border: `1px solid ${tokens.color.border}` }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '14px', color: tokens.color.textSecond }}>
          Confirmar Nova Senha
          <input
            type="password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder="Confirmar nova senha"
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
          {loading ? 'Redefinindo...' : 'Redefinir Senha'}
        </button>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              // Navigate back to login - in a real app we'd use routing
              // For now, we'll just clear the form
              setToken('');
              setSenha('');
              setConfirmacao('');
              setError(null);
              setSuccess(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.color.accent,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px',
            }}
          >
            Voltar para login
          </button>
        </div>
      </div>
    </div>
  );
}
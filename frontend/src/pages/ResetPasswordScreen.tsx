import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../utils/api';
import { Input } from '../components/inputs/input';
import { AuthShell } from './auth/AuthShell';
import type { AuthResult } from '../types';

interface ResetPasswordScreenProps {
  onAuthenticated?: (result: AuthResult) => void;
  /** Volta para a tela de login (App passa handleBackToLogin). */
  onVoltar?: () => void;
}

export function ResetPasswordScreen({ onVoltar }: ResetPasswordScreenProps) {
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validação ANTES de ligar o loading — antes, um erro de validação deixava
    // o botão preso em "Redefinindo...".
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

    setLoading(true);

    try {
      await api.resetPassword({ token: token.trim(), senha });
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

  // Mesmo layout do login do dono, com o quadrado "Recupere sua senha" aceso.
  return (
    <AuthShell role="dono" flow="login" activeStep={1}>
      <form className="auth-view" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Redefinir senha</h1>
        <p className="auth-subtitle">Cole o token recebido por email e escolha uma nova senha.</p>

        {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
        {success && <div className="auth-alert auth-alert--ok" role="status">{success}</div>}

        <div className="auth-fields">
          <Input name="reset_token" label="Token de redefinição" value={token} onChangeValue={setToken} placeholder="Cole o token recebido por email" />
          <Input name="reset_senha" type="password" label="Nova senha" value={senha} onChangeValue={setSenha} placeholder="Nova senha" autoComplete="new-password" />
          <Input name="reset_confirmacao" type="password" label="Confirmar nova senha" value={confirmacao} onChangeValue={setConfirmacao} placeholder="Confirmar nova senha" autoComplete="new-password" />
        </div>

        <button type="submit" className="auth-btn" disabled={loading}>
          {loading ? 'Redefinindo...' : 'Redefinir senha'}
        </button>

        <p className="auth-foot">
          <button type="button" className="auth-link" onClick={onVoltar}>Voltar ao login</button>
        </p>
      </form>
    </AuthShell>
  );
}

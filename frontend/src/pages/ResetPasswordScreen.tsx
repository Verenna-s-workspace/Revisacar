import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import { Input } from '../components/inputs/input';
import { AuthShell } from './auth/AuthShell';

interface ResetPasswordScreenProps {
  /** Token vindo do link do e-mail (/reset-password?token=...). Sem ele, o link é inválido. */
  token?: string | null;
  /** Volta para a tela de login (App passa handleBackToLogin). */
  onVoltar?: () => void;
}

const MIN_SENHA = 6;

/**
 * Tela aberta pelo link do e-mail de "esqueci minha senha". Mesmo layout do login do
 * dono, com o quadrado "Recupere sua senha" aceso. A pessoa só escolhe a nova senha —
 * o token vem do link e nunca é mostrado nem digitado.
 */
export function ResetPasswordScreen({ token, onVoltar }: ResetPasswordScreenProps) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  // O token sai da barra de endereço (histórico do navegador, cabeçalho Referer, print de
  // tela); daqui em diante ele existe só em memória.
  useEffect(() => {
    if (token) window.history.replaceState(null, '', '/reset-password');
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) return;

    // Validação ANTES de ligar o loading, para o botão nunca ficar preso em "Redefinindo...".
    if (senha.length < MIN_SENHA) {
      setError(`A senha deve ter pelo menos ${MIN_SENHA} caracteres`);
      return;
    }
    if (senha !== confirmacao) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword({ token, senha });
      setSenha('');
      setConfirmacao('');
      setConcluido(true);
    } catch (err) {
      setError(mensagemDoErro(err, 'Não foi possível redefinir a senha agora. Tente de novo em instantes.'));
    } finally {
      setLoading(false);
    }
  };

  // Abriu /reset-password sem token (link cortado, digitado à mão...).
  if (!token) {
    return (
      <AuthShell role="dono" flow="login" activeStep={1}>
        <div className="auth-view">
          <h1 className="auth-title">Link inválido</h1>
          <p className="auth-subtitle">
            Este link de redefinição não é válido ou expirou. Peça um novo na tela de login, em
            &ldquo;Esqueci minha senha&rdquo;.
          </p>
          <button type="button" className="auth-btn" onClick={onVoltar}>Voltar ao login</button>
        </div>
      </AuthShell>
    );
  }

  if (concluido) {
    return (
      <AuthShell role="dono" flow="login" activeStep={1}>
        <div className="auth-view">
          <h1 className="auth-title">Senha redefinida</h1>
          <div className="auth-alert auth-alert--ok" role="status">
            Pronto! Já pode entrar com a sua nova senha.
          </div>
          <button type="button" className="auth-btn" onClick={onVoltar}>Ir para o login</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell role="dono" flow="login" activeStep={1}>
      <form className="auth-view" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Redefinir senha</h1>
        <p className="auth-subtitle">Escolha uma nova senha para a sua conta.</p>

        {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}

        <div className="auth-fields">
          <Input name="reset_senha" type="password" label="Nova senha" value={senha} onChangeValue={setSenha} placeholder="Nova senha" autoComplete="new-password" autoFocus />
          <Input name="reset_confirmacao" type="password" label="Confirmar nova senha" value={confirmacao} onChangeValue={setConfirmacao} placeholder="Repita a senha" autoComplete="new-password" />
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

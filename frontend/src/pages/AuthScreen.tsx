import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../utils/api';
import { Input } from '../components/inputs/input';
import type { AuthResult } from '../types';
import type { AuthFlow } from './auth/authFlows';

interface AuthScreenProps {
  onAuthenticated: (result: AuthResult) => void;
  /** Avisa o painel da marca em qual fluxo/etapa esta tela está (acende o quadrado). */
  onProgress?: (flow: AuthFlow, step: number) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY: Record<AuthMode, { title: string; subtitle: string }> = {
  login: { title: 'Entrar', subtitle: 'Use o CNPJ da oficina e a sua senha.' },
  register: { title: 'Crie sua conta', subtitle: 'Cadastre a conta de administrador da oficina.' },
  forgot: { title: 'Esqueceu a senha?', subtitle: 'Informe o email cadastrado e enviaremos um link para redefinir.' },
};

/**
 * Formulário do DONO (CNPJ + senha). O layout (painel da marca, moldura,
 * deslize para o login de funcionário) é do AuthShell/AuthPage — aqui só
 * existe o conteúdo do lado do formulário.
 */
export function AuthScreen({ onAuthenticated, onProgress }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Quadrados do painel: cadastro (3, só o 1º existe por enquanto) ou
  // login (2: "Entre na sua conta" / "Recupere sua senha").
  useEffect(() => {
    onProgress?.(mode === 'register' ? 'cadastro' : 'login', mode === 'forgot' ? 1 : 0);
  }, [mode, onProgress]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setMessage(null);
    setConfirmarSenha('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'register') {
      if (!EMAIL_REGEX.test(email.trim())) {
        setError('Email inválido');
        return;
      }
      if (senha !== confirmarSenha) {
        setError('As senhas não coincidem');
        return;
      }
    }

    setLoading(true);

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

      // TODO(cadastro): etapas 2 ("Cadastre as informações da sua oficina") e
      // 3 ("Seja bem-vindo ao Revisacar") ainda não existem. Quando forem
      // implementadas, criarAdmin passa a avançar a etapa em vez de autenticar
      // direto (onProgress('cadastro', 1) …) — os quadrados já estão no painel.
      const result = mode === 'login'
        ? await api.loginAdmin({ doc: payload.doc, senha: payload.senha })
        : await api.criarAdmin(payload);

      onAuthenticated(result as AuthResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado';
      setError(msg.replace(/"/g, ''));
    } finally {
      setLoading(false);
    }
  };

  const { title, subtitle } = COPY[mode];

  return (
    <form className="auth-view" key={mode} onSubmit={handleSubmit} noValidate>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>

      {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
      {message && <div className="auth-alert auth-alert--ok" role="status">{message}</div>}

      <div className="auth-fields">
        {mode === 'register' && (
          <Input name="auth_nome" label="Nome" value={nome} onChangeValue={setNome} placeholder="Seu nome" autoComplete="name" />
        )}

        {mode !== 'forgot' && (
          <Input name="auth_cnpj" type="cpf_cnpj" label="CNPJ" value={doc} onChangeValue={setDoc} placeholder="00.000.000/0000-00" />
        )}

        {mode === 'register' && (
          <Input name="auth_email" type="email" label="Email" value={email} onChangeValue={setEmail} placeholder="seu@email.com" />
        )}

        {mode === 'login' && (
          <Input name="auth_senha" type="password" label="Senha" value={senha} onChangeValue={setSenha} placeholder="Sua senha" autoComplete="current-password" />
        )}

        {mode === 'register' && (
          <div className="auth-row">
            <Input name="auth_senha" type="password" label="Senha" value={senha} onChangeValue={setSenha} placeholder="Senha segura" autoComplete="new-password" />
            <Input name="auth_senha_confirm" type="password" label="Confirmar senha" value={confirmarSenha} onChangeValue={setConfirmarSenha} placeholder="Repita a senha" autoComplete="new-password" />
          </div>
        )}

        {mode === 'forgot' && (
          <Input name="auth_email_forgot" type="email" label="Email" value={email} onChangeValue={setEmail} placeholder="seu@email.com" autoFocus />
        )}
      </div>

      {mode === 'login' && (
        <div className="auth-row-end">
          <button type="button" className="auth-link" onClick={() => switchMode('forgot')}>
            Esqueci minha senha
          </button>
        </div>
      )}

      <button type="submit" className="auth-btn" disabled={loading}>
        {loading ? 'Processando...' : mode === 'forgot' ? 'Enviar link' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
      </button>

      <p className="auth-foot">
        {mode === 'login' && (
          <>Ainda não tem conta?<button type="button" className="auth-link" onClick={() => switchMode('register')}>Cadastre-se</button></>
        )}
        {mode === 'register' && (
          <>Já tem uma conta?<button type="button" className="auth-link" onClick={() => switchMode('login')}>Entrar</button></>
        )}
        {mode === 'forgot' && (
          <button type="button" className="auth-link" onClick={() => switchMode('login')}>Voltar ao login</button>
        )}
      </p>
    </form>
  );
}

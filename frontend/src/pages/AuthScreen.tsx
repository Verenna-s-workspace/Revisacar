import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../utils/api';
import { Input } from '../components/inputs/input';
import type { AuthResult } from '../types';
import type { AuthFlow } from './auth/authFlows';
import { IgnicaoBoasVindas, prepararAudioIgnicao } from './auth/Animations/ignicao';

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
  // Etapa 3 do cadastro: guarda o resultado da conta criada. A sessão só é
  // entregue ao app (onAuthenticated) quando a animação termina.
  const [cadastroConcluido, setCadastroConcluido] = useState<AuthResult | null>(null);

  // SÓ EM DESENVOLVIMENTO: abrir a tela com ?ignicao na URL arma a prévia da
  // animação. Cada clique na página a dispara (o clique também libera o áudio),
  // sem criar conta nem sessão. Em produção import.meta.env.DEV é false e este
  // bloco é removido do build.
  const [previaArmada] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('ignicao'),
  );
  const [previaTocando, setPreviaTocando] = useState(false);
  useEffect(() => {
    if (!previaArmada || previaTocando) return;
    const disparar = () => {
      prepararAudioIgnicao();
      setPreviaTocando(true);
    };
    window.addEventListener('pointerdown', disparar, { once: true });
    return () => window.removeEventListener('pointerdown', disparar);
  }, [previaArmada, previaTocando]);

  // Quadrados do painel: cadastro (3, só o 1º existe por enquanto) ou
  // login (2: "Entre na sua conta" / "Recupere sua senha").
  useEffect(() => {
    if (cadastroConcluido) return; // etapa 3 já foi sinalizada; não volta ao 1º quadrado
    onProgress?.(mode === 'register' ? 'cadastro' : 'login', mode === 'forgot' ? 1 : 0);
  }, [mode, onProgress, cadastroConcluido]);

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
      // Ainda dentro do gesto de clique (antes de qualquer await): cria/destrava
      // o AudioContext para a animação poder tocar som (política de autoplay).
      prepararAudioIgnicao();
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

      // TODO(cadastro): a etapa 2 ("Cadastre as informações da sua oficina") fica
      // entre a conta e a animação. Quando for integrada (branch
      // feat/cadastro-etapa-2-dados-oficina), o ramo de cadastro abaixo passa a
      // avançar para ela (onProgress('cadastro', 1)), e é o onConcluir da
      // etapa 2 que faz setCadastroConcluido + onProgress('cadastro', 2).
      if (mode === 'login') {
        const result = await api.loginAdmin({ doc: payload.doc, senha: payload.senha });
        onAuthenticated(result as AuthResult);
        return;
      }

      // Cadastro novo: etapa 3 (animação de boas-vindas), depois o dashboard.
      const result = await api.criarAdmin(payload);
      setCadastroConcluido(result as AuthResult);
      onProgress?.('cadastro', 2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado';
      setError(msg.replace(/"/g, ''));
    } finally {
      setLoading(false);
    }
  };

  const { title, subtitle } = COPY[mode];

  return (
    <>
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

        <button type="submit" className="auth-btn" disabled={loading || !!cadastroConcluido}>
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

      {/* Portal no <body>: o painel de auth usa transform/will-change, que
          quebrariam o position: fixed do overlay de tela cheia. */}
      {previaTocando &&
        createPortal(<IgnicaoBoasVindas onConcluir={() => setPreviaTocando(false)} />, document.body)}
      {cadastroConcluido &&
        createPortal(
          <IgnicaoBoasVindas onConcluir={() => onAuthenticated(cadastroConcluido)} />,
          document.body,
        )}
    </>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthShell } from './auth/AuthShell';
import { AUTH_SLIDE_MS, AUTH_SWAP_AT_MS, DEFAULT_FLOW_BY_ROLE } from './auth/authFlows';
import type { AuthFlow, AuthRole } from './auth/authFlows';
import { AuthScreen } from './AuthScreen';
import { FuncionarioLoginScreen } from './FuncionarioLogin/FuncionarioLoginScreen';
import type { AuthResult } from '../types';

interface AuthPageProps {
  onAuthenticated: (result: AuthResult, role: AuthRole) => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tela única de autenticação (dono ⇄ funcionário).
 *
 * Precisa ser UM componente que não desmonta ao trocar de lado — é isso que
 * permite o painel da marca deslizar em vez de a tela inteira ser trocada.
 *
 * Linha do tempo da troca (ver AUTH_SLIDE_MS / AUTH_SWAP_AT_MS):
 *   0 ms     painel começa a deslizar, gradiente cruza, formulário atual some
 *   ~360 ms  painel já cobre a área do formulário → troca o formulário
 *   ~800 ms  painel chega ao outro lado; novo formulário já está visível
 */
export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [role, setRole] = useState<AuthRole>('dono');          // lado do painel + gradiente
  const [formRole, setFormRole] = useState<AuthRole>('dono');  // formulário montado
  const [formVisible, setFormVisible] = useState(true);
  const [moving, setMoving] = useState(false);
  const [progress, setProgress] = useState<{ flow: AuthFlow; step: number }>({ flow: 'login', step: 0 });

  const targetRole = useRef<AuthRole>('dono');
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const switchRole = useCallback((next: AuthRole) => {
    if (next === targetRole.current) return;
    targetRole.current = next;
    clearTimers();

    setRole(next);
    // O painel já mostra o texto/quadrados do novo lado desde o começo do deslize.
    setProgress({ flow: DEFAULT_FLOW_BY_ROLE[next], step: 0 });

    if (prefersReducedMotion()) {
      setFormRole(next);
      setFormVisible(true);
      return;
    }

    setMoving(true);
    setFormVisible(false);
    timers.current.push(window.setTimeout(() => {
      setFormRole(next);
      setFormVisible(true);
    }, AUTH_SWAP_AT_MS));
    timers.current.push(window.setTimeout(() => setMoving(false), AUTH_SLIDE_MS + 120));
  }, []);

  // Os formulários dizem em qual fluxo/etapa estão; o painel acende o quadrado certo.
  const handleProgress = useCallback((flow: AuthFlow, step: number) => {
    setProgress((prev) => (prev.flow === flow && prev.step === step ? prev : { flow, step }));
  }, []);

  return (
    <AuthShell
      role={role}
      flow={progress.flow}
      activeStep={progress.step}
      formVisible={formVisible}
      moving={moving}
      onRoleChange={switchRole}
    >
      {formRole === 'dono' ? (
        <AuthScreen
          onAuthenticated={(result) => onAuthenticated(result, 'dono')}
          onProgress={handleProgress}
        />
      ) : (
        <FuncionarioLoginScreen
          onAuthenticated={(result) => onAuthenticated(result, 'funcionario')}
          onProgress={handleProgress}
        />
      )}
    </AuthShell>
  );
}

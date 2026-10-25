import type { CSSProperties, ReactNode } from 'react';
import { AUTH_FLOWS } from './authFlows';
import type { AuthFlow, AuthRole } from './authFlows';
import './auth.css';

interface AuthShellProps {
  /** Lado do painel e gradiente: 'dono' = esquerda (claro), 'funcionario' = direita (escuro). */
  role: AuthRole;
  flow: AuthFlow;
  /** Índice (0-based) do quadrado aceso. Os anteriores aparecem com ✓. */
  activeStep: number;
  /** false enquanto o formulário está "escondido" pelo painel durante a troca. */
  formVisible?: boolean;
  /** true durante a animação — liga will-change só enquanto precisa. */
  moving?: boolean;
  /** Sem esta prop o seletor Dono/Funcionário não é mostrado. */
  onRoleChange?: (role: AuthRole) => void;
  children: ReactNode;
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.4 6.6 11.5 12.5 4.8" />
    </svg>
  );
}

export function AuthShell({
  role, flow, activeStep, formVisible = true, moving = false, onRoleChange, children,
}: AuthShellProps) {
  const cfg = AUTH_FLOWS[flow];

  return (
    <div className="auth-page">
      <div className={`auth-card${moving ? ' is-moving' : ''}`} data-role={role}>
        <div className="auth-stage">
          {/* ── Painel da marca (40%) ─────────────────────────────────────── */}
          <aside className="auth-brand">
            {/* Duas camadas de gradiente empilhadas. Trocar de lado só anima a
                opacidade da camada escura (barato: compositor, sem repaint). */}
            <div className="auth-bg auth-bg--light" aria-hidden="true">
              <i className="auth-blob b1" /><i className="auth-blob b2" /><i className="auth-blob b3" />
            </div>
            <div className="auth-bg auth-bg--dark" aria-hidden="true">
              <i className="auth-blob b1" /><i className="auth-blob b2" /><i className="auth-blob b3" />
            </div>

            <div className="auth-brand-inner">
              <header className="auth-brand-top">
                <div className="auth-logo">
                  <img src="/Logorevisavermelha.svg" alt="" width={88} height={88} loading="eager" />
                  <span>RevisaCar</span>
                </div>

                {onRoleChange && (
                  <div className="auth-switch" role="group" aria-label="Tipo de acesso" data-role={role}>
                    <span className="auth-switch-thumb" aria-hidden="true" />
                    <button type="button" aria-pressed={role === 'dono'} onClick={() => onRoleChange('dono')}>
                      Dono
                    </button>
                    <button type="button" aria-pressed={role === 'funcionario'} onClick={() => onRoleChange('funcionario')}>
                      Funcionário
                    </button>
                  </div>
                )}
              </header>

              <div className="auth-brand-bottom">
                {/* key = fluxo → o texto reaparece com fade ao trocar de fluxo */}
                <div className="auth-copy" key={flow}>
                  <span className="auth-pill">{cfg.pill}</span>
                  <h2>{cfg.title}</h2>
                  <p>{cfg.subtitle}</p>
                </div>

                <ol className="auth-steps" key={`steps-${flow}`} style={{ '--n': cfg.steps.length } as CSSProperties} aria-label="Etapas">
                  {cfg.steps.map((label, i) => {
                    const state = i === activeStep ? 'active' : i < activeStep ? 'done' : 'idle';
                    return (
                      <li
                        key={label}
                        className={`auth-step is-${state}`}
                        style={{ '--i': i } as CSSProperties}
                        aria-current={state === 'active' ? 'step' : undefined}
                      >
                        <span className="auth-step-num">{state === 'done' ? <CheckIcon /> : i + 1}</span>
                        <span className="auth-step-label">{label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </aside>

          {/* ── Lado do formulário (60%) ──────────────────────────────────── */}
          <main className="auth-form-pane">
            <div className="auth-form-scroll">
              <div className="auth-form-inner" data-visible={formVisible}>
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

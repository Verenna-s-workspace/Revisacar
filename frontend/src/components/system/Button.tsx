import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './system.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = a única ação principal da tela (cor de marca). */
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
  loading?: boolean;
  /** Ícone antes do texto. */
  icon?: ReactNode;
}

/**
 * Botão único do app. Um primário por tela · raio 8 · texto 14.
 * Os estilos antigos (btnAccent, btnGhost…) em components/ui.tsx apontam para estas mesmas regras.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, loading, icon, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const cls = [
    'sys-btn', `sys-btn--${variant}`,
    size === 'sm' ? 'sys-btn--sm' : '',
    block ? 'sys-btn--block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="sys-btn__spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

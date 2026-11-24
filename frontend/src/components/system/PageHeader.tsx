import type { ReactNode } from 'react';
import './system.css';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Ações à direita; a primária (se houver) é o único botão de marca da tela. */
  actions?: ReactNode;
  /** Nível do título (h1 nas telas cheias, h2 nas páginas do painel). */
  as?: 'h1' | 'h2';
}

/** Cabeçalho de página: título 24 (20 no celular) + subtítulo 14 + ações à direita. */
export function PageHeader({ title, subtitle, actions, as: Tag = 'h2' }: PageHeaderProps) {
  return (
    <header className="sys-page-header">
      <div className="sys-page-header__text">
        <Tag className="sys-page-header__title">{title}</Tag>
        {subtitle && <p className="sys-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="sys-page-header__actions">{actions}</div>}
    </header>
  );
}

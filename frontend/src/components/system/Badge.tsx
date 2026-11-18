import type { CSSProperties, ReactNode } from 'react';
import { ICONES_STATUS } from './icons';
import { estiloFase, infoStatusOS } from '../../utils/ordem_status';
import type { FaseOS } from '../../utils/ordem_status';
import './system.css';

type Tom = 'ok' | 'warn' | 'crit' | 'neutral';

const TONS: Record<Tom, CSSProperties> = {
  ok:      { color: 'var(--color-ok)',   background: 'var(--color-ok-bg)' },
  warn:    { color: 'var(--color-warn)', background: 'var(--color-warn-bg)' },
  crit:    { color: 'var(--color-crit)', background: 'var(--color-crit-bg)' },
  neutral: { color: 'var(--color-muted)', background: 'var(--color-surface-high)' },
};

interface BadgeProps {
  /** Uma das 8 fases da OS… */
  fase?: FaseOS;
  /** …ou um tom semântico (ok / atenção / crítico / neutro). */
  tom?: Tom;
  icon?: ReactNode;
  size?: 'md' | 'sm';
  title?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Selo em pílula: cor + (opcional) ícone. Crítico deve vir sempre com ícone. */
export function Badge({ fase, tom = 'neutral', icon, size = 'md', title, style, children }: BadgeProps) {
  const cores = fase ? { color: estiloFase(fase).color, background: estiloFase(fase).bg } : TONS[tom];
  return (
    <span className={`sys-badge${size === 'sm' ? ' sys-badge--sm' : ''}`} style={{ ...cores, ...style }} title={title}>
      {icon && <span className="sys-badge__icon">{icon}</span>}
      {children}
    </span>
  );
}

/** Selo do status da OS: cor, ícone e rótulo vêm da tabela única (utils/ordem_status.ts). */
export function StatusOSBadge({ status, size = 'md', semIcone = false }: { status: string; size?: 'md' | 'sm'; semIcone?: boolean }) {
  const info = infoStatusOS(status);
  return (
    <Badge fase={info.fase} size={size} icon={semIcone ? undefined : ICONES_STATUS[info.icone]}>
      {info.rotulo}
    </Badge>
  );
}

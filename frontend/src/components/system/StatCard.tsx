import type { CSSProperties, ReactNode } from 'react';
import './system.css';

interface StatCardProps {
  label: string;
  /** Já formatado (ex.: R$ 10.486,00). Use <Valor> quando o valor puder ser mascarado. */
  value: ReactNode;
  /** Valor em destaque (32px) em vez de 24px. */
  destaque?: boolean;
  /** Ícone neutro opcional ao lado do rótulo (nunca em caixa vermelha). */
  icon?: ReactNode;
  /** Linha de variação/rodapé (ex.: “+12% sobre setembro”). */
  foot?: ReactNode;
  /** Faixa lateral semântica (Financeiro): verde entra, crítico sai, neutro resultado. */
  stripe?: string;
  /** Texto/aviso à direita do rótulo (ex.: “R$ 120,00 vencido”). */
  extra?: ReactNode;
  /** Alvo do destaque de chegada (ver utils/destaque.ts). */
  destaqueId?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Cartão de métrica: rótulo 14, valor 24/32 (tabular), rodapé 12. */
export function StatCard({ label, value, destaque, icon, foot, stripe, extra, destaqueId, style, children }: StatCardProps) {
  return (
    <div
      className={`sys-stat${destaque ? ' sys-stat--lg' : ''}${stripe ? ' sys-stat--stripe' : ''}`}
      style={{ ...(stripe ? ({ '--sys-stat-stripe': stripe } as CSSProperties) : null), ...style }}
      data-destaque-id={destaqueId}
    >
      <div className="sys-stat__label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={icon ? { display: 'flex', alignItems: 'center', gap: 8 } : undefined}>
          {icon && <span style={{ display: 'inline-flex', color: 'var(--color-muted)' }}>{icon}</span>}
          {label}
        </span>
        {extra}
      </div>
      <div className="sys-stat__value">{value}</div>
      {foot && <div className="sys-stat__foot">{foot}</div>}
      {children}
    </div>
  );
}

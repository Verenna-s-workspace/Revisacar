import type { CSSProperties, ReactNode } from 'react';
import { tokens } from '../../../constants';
import { Skeleton } from '../Primitives';

interface KanbanColunaProps {
  titulo: string;
  count: number;
  children: ReactNode;
  /** Largura/scroll-snap são definidos pelo KanbanBoard (difere mobile x desktop). */
  style?: CSSProperties;
  /** Enquanto carrega, mostra skeleton em vez de "Nenhum item aqui." e contador 0. */
  loading?: boolean;
}

export function KanbanColuna({ titulo, count, children, style, loading = false }: KanbanColunaProps) {
  return (
    <div
      className="dashboard-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '13px 11px 11px',
        minHeight: 0,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 3px 11px', flexShrink: 0 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: '0.78rem',
            color: tokens.color.text,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {titulo}
        </span>
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 99,
            background: tokens.color.surfaceHigh,
            color: tokens.color.textSecond,
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? '–' : count}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {loading ? (
          <>
            <Skeleton h={58} r={10} />
            <Skeleton h={58} r={10} />
          </>
        ) : count === 0 ? (
          <div style={{ fontSize: '0.78rem', color: tokens.color.muted, textAlign: 'center', padding: '22px 8px' }}>
            Nenhum item aqui.
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

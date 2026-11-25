import { Children, useState } from 'react';
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
  /**
   * Quantos cards aparecem antes do botão "Ver mais". Coluna com dezenas de
   * itens deixava a tela interminável (mobile) ou espremida (desktop).
   */
  limite?: number;
}

export function KanbanColuna({ titulo, count, children, style, loading = false, limite = 8 }: KanbanColunaProps) {
  const [expandido, setExpandido] = useState(false);
  const itens = Children.toArray(children);
  const temExcedente = itens.length > limite;
  const visiveis = temExcedente && !expandido ? itens.slice(0, limite) : itens;
  const ocultos = itens.length - limite;

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

      <div className="kanban-lista" style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 0 }}>
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
          <>
            {visiveis}
            {temExcedente && (
              <button
                type="button"
                onClick={() => setExpandido(e => !e)}
                aria-expanded={expandido}
                style={{
                  minHeight: 44, width: '100%', cursor: 'pointer',
                  border: `1px dashed ${tokens.color.border}`, borderRadius: 10,
                  background: 'transparent', color: tokens.color.textSecond,
                  fontFamily: tokens.fontSans, fontSize: '0.8125rem', fontWeight: 700,
                }}
              >
                {expandido ? 'Mostrar menos' : `Ver mais ${ocultos} ${ocultos === 1 ? 'item' : 'itens'}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

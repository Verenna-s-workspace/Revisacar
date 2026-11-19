import { useState } from 'react';
import type { ReactNode } from 'react';
import { Skeleton } from '../../Primitives';

interface ColunaProps {
  titulo: string;
  /** Cor do ponto ao lado do título (tom da coluna). */
  cor: string;
  total: number;
  /** Os cartões, já renderizados (ordem de exibição). */
  cartoes: ReactNode[];
  loading: boolean;
  textoVazio: string;
  /** Quantos cartões aparecem antes de "Ver mais". */
  limite?: number;
}

export function ColunaAtendimento({ titulo, cor, total, cartoes, loading, textoVazio, limite = 4 }: ColunaProps) {
  const [expandida, setExpandida] = useState(false);
  const excede = cartoes.length > limite;
  const visiveis = excede && !expandida ? cartoes.slice(0, limite) : cartoes;
  const ocultos = cartoes.length - limite;

  return (
    <section className="at-coluna" aria-label={titulo}>
      <header className="at-coluna__cab">
        <span className="at-coluna__ponto" style={{ background: cor }} aria-hidden="true" />
        <h2 className="at-coluna__titulo">{titulo}</h2>
        <span className="at-coluna__total" aria-label={`${total} ${total === 1 ? 'item' : 'itens'}`}>
          {loading ? '–' : total}
        </span>
      </header>

      {loading ? (
        <>
          <Skeleton h={110} r={8} />
          <Skeleton h={110} r={8} />
        </>
      ) : cartoes.length === 0 ? (
        <div className="at-coluna__vazio">{textoVazio}</div>
      ) : (
        <>
          {visiveis}
          {excede && (
            <button
              type="button"
              className="at-vermais"
              aria-expanded={expandida}
              onClick={() => setExpandida(v => !v)}
            >
              {expandida ? 'Mostrar menos' : `Ver mais ${ocultos}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

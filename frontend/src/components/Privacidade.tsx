import type { CSSProperties, ReactNode } from 'react';
import { usePrivacidade } from '../context/PrivacidadeContext';
import { Icons } from '../features/Dashboard/Icons';

export const MASCARA_MOEDA = 'R$ ••••••';
export const MASCARA_NUMERO = '••••••';
export const MASCARA_PERCENTUAL = '••%';

/** Largura aproximada do texto em "ch" (largura do dígito 0). Serve pra a máscara
 *  ocupar o mesmo espaço do valor real e a tela não "pular" ao ligar/desligar. */
function larguraEmCh(texto: string): number {
  let w = 0;
  for (const c of texto) {
    if (/\d/.test(c)) w += 1;
    else if (c === '.' || c === ',') w += 0.45;
    else if (c === ' ') w += 0.32;
    else if (c === '%') w += 1.4;
    else if (c === '-' || c === '+') w += 0.7;
    else w += 0.95;
  }
  return Math.ceil(w * 10) / 10;
}

/**
 * Mostra um valor financeiro já formatado (ex.: formatBRL(x)) ou a máscara.
 * Com a máscara ligada o número real NÃO é renderizado (nada no DOM pra copiar
 * ou pro leitor de tela ler) e o espaço reservado é o do valor real.
 */
export function Valor({ texto, mascara = MASCARA_MOEDA }: { texto: string; mascara?: string }) {
  const { oculto } = usePrivacidade();
  if (!oculto) return <>{texto}</>;
  return (
    <span className="privacidade-mascara" style={{ minWidth: `${larguraEmCh(texto)}ch` }}>
      <span className="privacidade-sr">Valor oculto</span>
      <span aria-hidden="true">{mascara}</span>
    </span>
  );
}

interface GraficoPrivadoProps {
  children: ReactNode;
  /** false = não esconde (ex.: gráfico de quantidade, quando o usuário não vê dinheiro). */
  ativo?: boolean;
  /** Mostra o selo "Valores ocultos" por cima. Desligue em gráficos pequenos. */
  selo?: boolean;
  style?: CSSProperties;
}

/** Envolve um gráfico com valores financeiros: borra o desenho, desliga o
 *  tooltip e mantém exatamente a mesma altura (sem layout shift). */
export function GraficoPrivado({ children, ativo = true, selo = true, style }: GraficoPrivadoProps) {
  const { oculto } = usePrivacidade();
  const esconder = oculto && ativo;
  return (
    <div className="privacidade-grafico" style={style}>
      <div
        className={`privacidade-grafico__conteudo${esconder ? ' privacidade-blur' : ''}`}
        style={style?.height ? { height: '100%' } : undefined}
        aria-hidden={esconder || undefined}
      >
        {children}
      </div>
      {esconder && selo && (
        <div className="privacidade-grafico__selo" role="img" aria-label="Valores ocultos">
          {Icons.eyeOff}
          <span>Valores ocultos</span>
        </div>
      )}
    </div>
  );
}

/** Botão olho / olho cortado do cabeçalho. `desktop` usa o estilo do sino; `mobile` o da topbar. */
export function BotaoPrivacidade({ variante }: { variante: 'desktop' | 'mobile' }) {
  const { oculto, alternar, interagiu } = usePrivacidade();
  const base = variante === 'mobile' ? 'dashboard-mobile-topbar__button' : 'dashboard-button';
  return (
    <>
      <button
        type="button"
        className={`${base} privacidade-botao${oculto ? ' privacidade-botao--ativo' : ''}`}
        onClick={alternar}
        aria-pressed={oculto}
        aria-label="Ocultar valores financeiros"
        title={oculto ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
      >
        <span key={oculto ? 'oculto' : 'visivel'} className="privacidade-botao__icone">
          {oculto ? Icons.eyeOff : Icons.eye}
        </span>
      </button>
      {interagiu && (
        <span className="privacidade-sr" role="status" aria-live="polite">
          {oculto ? 'Valores financeiros ocultos' : 'Valores financeiros visíveis'}
        </span>
      )}
    </>
  );
}

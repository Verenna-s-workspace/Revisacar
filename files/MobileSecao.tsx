import type { ReactNode } from 'react';
import { IcSetaDir, IcSetaEsq } from '../icones';

interface MobileSecaoProps {
  titulo: ReactNode;
  /** "dia" | "semana" | "mês" — só para os rótulos acessíveis dos botões. */
  periodo: 'dia' | 'semana' | 'mês';
  onHoje: () => void;
  onAnterior: () => void;
  onProximo: () => void;
}

/**
 * Linha de seção do Figma ("Terça, 17 · 3 agendamentos") com a navegação do período à direita:
 * Hoje · anterior · próximo — o mesmo trio do cabeçalho do desktop, em alvos de 44 px.
 */
export function MobileSecao({ titulo, periodo, onHoje, onAnterior, onProximo }: MobileSecaoProps) {
  const anterior = periodo === 'mês' ? 'Mês anterior' : `${periodo === 'dia' ? 'Dia' : 'Semana'} anterior`;
  const proximo = periodo === 'mês' ? 'Próximo mês' : `${periodo === 'dia' ? 'Próximo dia' : 'Próxima semana'}`;
  return (
    <div className="agm-secao">
      <h2 className="agm-secao__titulo">{titulo}</h2>
      <div className="agm-secao__nav">
        <button type="button" className="agm-nav-btn agm-nav-btn--texto" onClick={onHoje}>Hoje</button>
        <button type="button" className="agm-nav-btn" aria-label={anterior} onClick={onAnterior}>{IcSetaEsq}</button>
        <button type="button" className="agm-nav-btn" aria-label={proximo} onClick={onProximo}>{IcSetaDir}</button>
      </div>
    </div>
  );
}

import { Button } from '../system';
import type { EtapaFase } from '../../utils/os_fases';
import { IconeEtapa, textoEstado } from './IconeEtapa';
import './os-fase.css';

interface PainelResumoProps {
  titulo: string;                       // "Resumo da entrada"
  etapas: readonly EtapaFase[];
  atual: number;
  onSelecionar: (id: number) => void;
  concluidas: number;
  total: number;
  /** A ação principal da fase ("Concluir entrada e diagnosticar"): sempre na mesma posição. */
  acao: { rotulo: string; desabilitada: boolean; ocupada?: boolean; onClick: () => void };
  ajuda: string;
  /** "Salvo automaticamente às 09:05". */
  salvo?: string;
}

const IcSeta = <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

/** Painel lateral fixo "Resumo da <fase>": etapas clicáveis com status, contador e a ação principal da fase. */
export function PainelResumo({ titulo, etapas, atual, onSelecionar, concluidas, total, acao, ajuda, salvo }: PainelResumoProps) {
  return (
    <aside className="osf-resumo" aria-label={titulo}>
      <div className="osf-resumo__topo">
        <h2 className="osf-resumo__titulo">{titulo}</h2>
        <span className="osf-resumo__cont">{concluidas} de {total}</span>
      </div>
      <ul className="osf-resumo__lista">
        {etapas.map((e) => (
          <li key={e.id}>
            <button
              type="button" className="osf-resumo__item" disabled={e.bloqueada}
              aria-current={e.id === atual ? 'step' : undefined} onClick={() => onSelecionar(e.id)}
            >
              <IconeEtapa estado={e.estado} numero={e.id} />
              <span className="osf-resumo__txt">
                <span className="osf-resumo__rot">{e.rotulo}<span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{`, ${textoEstado(e.estado)}`}</span></span>
                <span className="osf-resumo__det">{e.detalhe}</span>
                {e.pendencia && <span className="osf-resumo__pend">{e.pendencia}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="osf-resumo__sep" />
      <Button variant="primary" className="osf-resumo__cta" icon={IcSeta} disabled={acao.desabilitada} loading={acao.ocupada} onClick={acao.onClick}>
        {acao.rotulo}
      </Button>
      <p className="osf-resumo__ajuda" role="status">{ajuda}</p>
      {salvo && <p className="osf-resumo__salvo">{salvo}</p>}
    </aside>
  );
}

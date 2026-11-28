import type { Section } from '../../../types';
import { SectionIcon } from '../../../components/ui';
import type { ContagemSistema } from '../../../utils/diagnostico_os';
import { IcCheck, IcMais } from './icones';
import './diagnostico.css';

interface MenuSistemasProps {
  sistemas: Section[];
  ativo?: string;
  contagens: Record<string, ContagemSistema>;
  /** Itens verificados e total, somando todos os sistemas da OS. */
  feitos: number;
  total: number;
  onSelecionar: (id: string) => void;
  onAdicionar: () => void;
}

/**
 * Menu dos sistemas adicionados à OS. Desktop largo: coluna à esquerda. Demais larguras: tira horizontal
 * rolável acima do card (alvos de 44px). "+ Adicionar sistema" abre a gaveta com a lista completa.
 */
export function MenuSistemas({ sistemas, ativo, contagens, feitos, total, onSelecionar, onAdicionar }: MenuSistemasProps) {
  return (
    <nav className="osd-menu" aria-label="Sistemas da OS">
      <h2 className="osd-menu__tit" title="Itens verificados em todos os sistemas da OS">Sistemas · {feitos} de {total}</h2>
      <ul className="osd-menu__lista">
        {sistemas.map((sec) => {
          const c = contagens[sec.id];
          return (
            <li key={sec.id}>
              <button
                type="button" className="osd-sis" aria-current={sec.id === ativo ? 'true' : undefined} onClick={() => onSelecionar(sec.id)}
              >
                {c?.completo
                  ? <span className="osd-sis__ok"><IcCheck size={16} /></span>
                  : <span className="osd-sel__ic"><SectionIcon id={sec.id} size={16} /></span>}
                <span className="osd-sis__nome">{sec.label}</span>
                {c && c.crit > 0 && (
                  <>
                    <span className="osd-sis__crit" aria-hidden="true" />
                    <span className="osd-sr">{`, ${c.crit} crítico${c.crit > 1 ? 's' : ''}`}</span>
                  </>
                )}
                <span className="osd-sis__cont">{c ? `${c.feitos}/${c.total}` : ''}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className="osd-sis osd-sis--add" onClick={onAdicionar}>
            <span className="osd-sel__ic"><IcMais size={16} /></span>
            <span className="osd-sis__nome">Adicionar sistema</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

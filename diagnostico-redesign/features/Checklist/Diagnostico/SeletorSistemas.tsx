import { SECTIONS } from '../../../constants';
import { SectionIcon } from '../../../components/ui';
import { Button } from '../../../components/system';
import { IcCheck } from './icones';
import './diagnostico.css';

interface SeletorSistemasProps {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  /** Grade na etapa Serviços; lista na gaveta "Sistemas da OS". */
  layout: 'grade' | 'lista';
}

/**
 * Escolha dos sistemas que entram na inspeção — a mesma regra de sempre (marcar/desmarcar um, ou todos),
 * usada na etapa Serviços e na gaveta aberta pelo "+ Adicionar sistema" do menu lateral.
 * Desmarcar não apaga o que já foi respondido: o registro volta se o sistema for marcado de novo.
 */
export function SeletorSistemas({ selected, onToggle, onToggleAll, layout }: SeletorSistemasProps) {
  const todos = selected.size === SECTIONS.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="osd-barra-acoes">
        <p className="osd-dica" role="status">
          {selected.size === 0 ? 'Selecione ao menos um sistema' : `${selected.size} de ${SECTIONS.length} sistemas selecionados`}
        </p>
        <Button variant="ghost" size="sm" onClick={onToggleAll}>{todos ? 'Desmarcar todos' : 'Selecionar todos'}</Button>
      </div>
      <div className={layout === 'grade' ? 'osd-grid-sel' : 'osd-sel-lista'} role="group" aria-label="Sistemas para inspeção">
        {SECTIONS.map((sec) => {
          const ativo = selected.has(sec.id);
          return (
            <button
              key={sec.id} type="button" role="checkbox" aria-checked={ativo} className="osd-sel" onClick={() => onToggle(sec.id)}
            >
              <span className="osd-sel__caixa" aria-hidden="true">{ativo && <IcCheck size={14} />}</span>
              <span className="osd-sel__ic"><SectionIcon id={sec.id} size={16} /></span>
              <span className="osd-sel__txt">
                <span className="osd-sel__nome">{sec.label}</span>
                <span className="osd-sel__det">{sec.isDynamic ? 'Itens que você digita' : `${sec.items.length} itens`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

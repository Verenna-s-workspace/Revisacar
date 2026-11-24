import type { Agendamento } from '../../../../types/agendamento';
import { toISODate, WEEKDAYS_LONG, WEEKDAYS_SHORT, MONTHS } from '../../../../utils/agenda';
import { contagem } from './agendaMobileUtils';

interface MobileDiasTiraProps {
  dias: Date[];
  /** Dia aberto (fundo escuro). Na visão Semana nenhum dia fica selecionado. */
  selecionado?: Date;
  porDia: Map<string, Agendamento[]>;
  onEscolher: (d: Date) => void;
}

/**
 * Tira de dias da semana (Seg 16 … Sáb 21), como no Figma: cada dia é um botão de largura igual
 * (Flexbox), com ponto vermelho quando há agendamento. O dia aberto fica escuro; hoje, em destaque suave.
 */
export function MobileDiasTira({ dias, selecionado, porDia, onEscolher }: MobileDiasTiraProps) {
  const hojeISO = toISODate(new Date());
  const selecionadoISO = selecionado ? toISODate(selecionado) : null;

  return (
    <div className="agm-tira" role="group" aria-label="Dias da semana">
      {dias.map(d => {
        const iso = toISODate(d);
        const n = porDia.get(iso)?.length ?? 0;
        const classe = ['agm-tira__dia', n > 0 ? 'agm-tira__dia--tem' : '', iso === hojeISO ? 'agm-tira__dia--hoje' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={iso}
            type="button"
            className={classe}
            aria-pressed={selecionadoISO === null ? undefined : iso === selecionadoISO}
            aria-current={iso === hojeISO ? 'date' : undefined}
            aria-label={`${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}, ${n === 0 ? 'sem agendamentos' : contagem(n)}`}
            onClick={() => onEscolher(d)}
          >
            <span className="agm-tira__nome">{WEEKDAYS_SHORT[d.getDay()]}</span>
            <span className="agm-tira__num">{d.getDate()}</span>
            <span className="agm-tira__ponto" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

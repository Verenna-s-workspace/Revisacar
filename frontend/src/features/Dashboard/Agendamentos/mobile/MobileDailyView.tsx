import { useMemo } from 'react';
import { addDays, toISODate } from '../../../../utils/agenda';
import type { Agendamento } from '../../../../types/agendamento';
import { IcCalendario } from '../icones';
import { agruparPorDia, diasDaTira, rotuloSecaoDia } from './agendaMobileUtils';
import { MobileDiasTira } from './MobileDiasTira';
import { MobileGradeDia } from './MobileGradeDia';
import { MobileSecao } from './MobileSecao';

interface MobileDailyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (d: Date) => void;
  onCardClick: (ag: Agendamento) => void;
  /** Abre o novo agendamento (data ISO opcional). */
  onNew: (isoDate?: string) => void;
}

/** Visão Dia: tira da semana (Figma) → "Terça, 17 · 3 agendamentos" → grade de horários → agendar. */
export function MobileDailyView({ date, agendamentos, onDateChange, onCardClick, onNew }: MobileDailyViewProps) {
  const iso = toISODate(date);
  const hojeISO = toISODate(new Date());
  const passado = iso < hojeISO;

  const porDia = useMemo(() => agruparPorDia(agendamentos), [agendamentos]);
  const dias = useMemo(() => diasDaTira(date, agendamentos, date), [date, agendamentos]);
  const doDia = porDia.get(iso) ?? [];

  return (
    <div className="agm-view">
      <MobileDiasTira dias={dias} selecionado={date} porDia={porDia} onEscolher={onDateChange} />

      <MobileSecao
        titulo={rotuloSecaoDia(date, doDia.length)}
        periodo="dia"
        onHoje={() => onDateChange(new Date())}
        onAnterior={() => onDateChange(addDays(date, -1))}
        onProximo={() => onDateChange(addDays(date, 1))}
      />

      {doDia.length === 0 ? (
        <div className="agm-vazio agm-vazio--borda">
          <span className="agm-vazio__icone">{IcCalendario}</span>
          <strong>Nenhum agendamento neste dia</strong>
          <span>{passado ? 'Este dia já passou e não tem agendamentos.' : 'O dia está livre para novos agendamentos.'}</span>
        </div>
      ) : (
        <MobileGradeDia dia={date} agendamentos={agendamentos} onCardClick={onCardClick} />
      )}

      <div className="agm-livre">
        <button type="button" className="agm-btn agm-btn--secundario agm-btn--bloco" onClick={() => onNew(passado ? undefined : iso)}>
          {/* ícone de "+" do Figma (Lucide plus) */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
          {passado ? 'Novo agendamento' : 'Agendar neste dia'}
        </button>
      </div>
    </div>
  );
}

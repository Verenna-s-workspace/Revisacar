import { useMemo } from 'react';
import { addDays, toISODate } from '../../../../utils/agenda';
import type { Agendamento } from '../../../../types/agendamento';
import { IcCalendario, IcSetaDir } from '../icones';
import { diasDaSemana, rotuloIntervalo } from '../agendamentosDesktopUtils';
import { agruparPorDia, contagem, diasDaTira, rotuloSecaoDia } from './agendaMobileUtils';
import { MobileAppointmentCard } from './MobileAppointmentCard';
import { MobileDiasTira } from './MobileDiasTira';
import { MobileSecao } from './MobileSecao';

interface MobileWeeklyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (d: Date) => void;
  onCardClick: (ag: Agendamento) => void;
  /** Toque em um dia: abre a visão Dia daquele dia (igual ao cabeçalho de dia do desktop). */
  onDayClick: (d: Date) => void;
  onNew: (isoDate?: string) => void;
}

/**
 * Visão Semana: no celular não cabem 6 colunas, então a semana vira uma tira de dias (com pontos) e,
 * abaixo, os agendamentos agrupados por dia — Segunda a Sábado; o domingo só entra se tiver agendamento.
 */
export function MobileWeeklyView({ date, agendamentos, onDateChange, onCardClick, onDayClick, onNew }: MobileWeeklyViewProps) {
  const porDia = useMemo(() => agruparPorDia(agendamentos), [agendamentos]);
  const dias = useMemo(() => diasDaTira(date, agendamentos), [date, agendamentos]);

  const semana = useMemo(() => {
    const sete = diasDaSemana(date).map(d => ({ d, iso: toISODate(d) }));
    return sete.map(x => ({ ...x, lista: porDia.get(x.iso) ?? [] }));
  }, [date, porDia]);

  const total = semana.reduce((n, x) => n + x.lista.length, 0);
  const comItens = semana.filter(x => x.lista.length > 0);
  const intervalo = rotuloIntervalo(dias[0], dias[dias.length - 1]);

  return (
    <div className="agm-view">
      <MobileDiasTira dias={dias} porDia={porDia} onEscolher={onDayClick} />

      <MobileSecao
        titulo={`${intervalo} · ${contagem(total)}`}
        periodo="semana"
        onHoje={() => onDateChange(new Date())}
        onAnterior={() => onDateChange(addDays(date, -7))}
        onProximo={() => onDateChange(addDays(date, 7))}
      />

      {comItens.length === 0 ? (
        <div className="agm-vazio agm-vazio--borda">
          <span className="agm-vazio__icone">{IcCalendario}</span>
          <strong>Nenhum agendamento nesta semana</strong>
          <span>Escolha outro período ou crie um agendamento.</span>
        </div>
      ) : (
        comItens.map(({ d, iso, lista }) => (
          <section key={iso} className="agm-grupo" aria-label={rotuloSecaoDia(d, lista.length)}>
            <button type="button" className="agm-grupo__cab" onClick={() => onDayClick(d)} aria-label={`Abrir ${rotuloSecaoDia(d, lista.length)}`}>
              <span>{rotuloSecaoDia(d, lista.length)}</span>
              {IcSetaDir}
            </button>
            <ul className="agm-lista">
              {lista.map(ag => (
                <li key={ag.id}><MobileAppointmentCard agendamento={ag} onClick={() => onCardClick(ag)} /></li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="agm-livre">
        <button type="button" className="agm-btn agm-btn--secundario agm-btn--bloco" onClick={() => onNew()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
          Novo agendamento
        </button>
      </div>
    </div>
  );
}

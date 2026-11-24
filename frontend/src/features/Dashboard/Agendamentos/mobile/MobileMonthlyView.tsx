import { useMemo } from 'react';
import { addMonths, toISODate } from '../../../../utils/agenda';
import type { Agendamento } from '../../../../types/agendamento';
import { CLASSE_STATUS, matrizDoMes, rotuloMes, SEMANA_CURTA_SEG } from '../agendamentosDesktopUtils';
import { agruparPorDia, capitalizar, contagem } from './agendaMobileUtils';
import { MobileSecao } from './MobileSecao';

const MAX_PONTOS = 3;

interface MobileMonthlyViewProps {
  date: Date;
  agendamentos: Agendamento[];
  onDateChange: (d: Date) => void;
  /** Toque em qualquer dia: abre a visão Dia (como no desktop). */
  onDayClick: (d: Date) => void;
}

/**
 * Visão Mês: grade de 7 colunas (segunda a domingo) em CSS Grid. Cada dia mostra o número e até 3
 * pontos na cor do status; o resumo exato fica na visão Dia, que abre ao tocar.
 */
export function MobileMonthlyView({ date, agendamentos, onDateChange, onDayClick }: MobileMonthlyViewProps) {
  const ano = date.getFullYear();
  const mes = date.getMonth();
  const hojeISO = toISODate(new Date());

  const semanas = useMemo(() => matrizDoMes(ano, mes), [ano, mes]);
  const porDia = useMemo(() => agruparPorDia(agendamentos), [agendamentos]);

  const prefixo = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const totalMes = agendamentos.filter(a => a.data.startsWith(prefixo)).length;

  return (
    <div className="agm-view">
      <MobileSecao
        titulo={`${capitalizar(rotuloMes(date))} · ${contagem(totalMes)}`}
        periodo="mês"
        onHoje={() => onDateChange(new Date())}
        onAnterior={() => onDateChange(addMonths(date, -1))}
        onProximo={() => onDateChange(addMonths(date, 1))}
      />

      <div className="agm-mes" role="group" aria-label={`Agenda de ${rotuloMes(date)}`}>
        <div className="agm-mes__nomes" aria-hidden="true">
          {SEMANA_CURTA_SEG.map(nome => <div key={nome} className="agm-mes__nome">{nome}</div>)}
        </div>

        {semanas.map(semana => (
          <div key={toISODate(semana[0])} className="agm-mes__semana">
            {semana.map(d => {
              const iso = toISODate(d);
              const lista = porDia.get(iso) ?? [];
              const pontos = lista.slice(0, MAX_PONTOS);
              const classe = [
                'agm-mes__dia',
                d.getMonth() !== mes ? 'agm-mes__dia--fora' : '',
                iso === hojeISO ? 'agm-mes__dia--hoje' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={iso}
                  type="button"
                  className={classe}
                  aria-current={iso === hojeISO ? 'date' : undefined}
                  aria-label={`Abrir dia ${d.getDate()} de ${rotuloMes(d).split(' de ')[0]}, ${lista.length === 0 ? 'sem agendamentos' : contagem(lista.length)}`}
                  onClick={() => onDayClick(d)}
                >
                  <span className="agm-mes__num">{d.getDate()}</span>
                  <span className="agm-mes__pontos" aria-hidden="true">
                    {pontos.map(ag => <span key={ag.id} className={`agm-mes__ponto ${CLASSE_STATUS[ag.status]}`} />)}
                    {lista.length > MAX_PONTOS && <span className="agm-mes__mais">+</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

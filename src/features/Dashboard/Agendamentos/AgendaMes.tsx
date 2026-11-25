import { useMemo } from 'react';
import type { Agendamento } from '../../../types/agendamento';
import { toISODate } from '../../../utils/agenda';
import { CLASSE_STATUS, matrizDoMes, SEMANA_CURTA_SEG } from './agendamentosDesktopUtils';

const MAX_CHIPS = 3;

interface AgendaMesProps {
  date: Date;
  agendamentos: Agendamento[];
  onCardClick: (ag: Agendamento) => void;
  /** Abre a visão Dia daquele dia. */
  onDayClick: (d: Date) => void;
}

/** Visão Mês: grade 7 colunas (segunda a domingo) em CSS Grid; cada dia lista até 3 agendamentos. */
export function AgendaMes({ date, agendamentos, onCardClick, onDayClick }: AgendaMesProps) {
  const ano = date.getFullYear();
  const mes = date.getMonth();
  const hojeISO = toISODate(new Date());

  const semanas = useMemo(() => matrizDoMes(ano, mes), [ano, mes]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Agendamento[]>();
    agendamentos.forEach(ag => {
      const lista = mapa.get(ag.data) ?? [];
      lista.push(ag);
      mapa.set(ag.data, lista);
    });
    mapa.forEach(lista => lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)));
    return mapa;
  }, [agendamentos]);

  return (
    <div className="ag-card">
      <div className="ag-mes" role="group" aria-label="Agenda do mês">
        <div className="ag-mes__semana-nomes">
          {SEMANA_CURTA_SEG.map(nome => (
            <div key={nome} className="ag-mes__nome">{nome}</div>
          ))}
        </div>

        <div className="ag-mes__corpo">
          {semanas.map(semana => (
            <div key={toISODate(semana[0])} className="ag-mes__semana">
              {semana.map(d => {
                const iso = toISODate(d);
                const doDia = porDia.get(iso) ?? [];
                const visiveis = doDia.slice(0, MAX_CHIPS);
                const resto = doDia.length - visiveis.length;
                const hoje = iso === hojeISO;
                const foraDoMes = d.getMonth() !== mes;
                return (
                  <div
                    key={iso}
                    className={`ag-mes__dia${foraDoMes ? ' ag-mes__dia--fora' : ''}`}
                    onClick={() => onDayClick(d)}
                  >
                    <button
                      type="button"
                      className={`ag-mes__num${hoje ? ' ag-mes__num--hoje' : ''}`}
                      onClick={e => { e.stopPropagation(); onDayClick(d); }}
                      aria-label={`Abrir dia ${d.getDate()}${doDia.length ? `, ${doDia.length} agendamentos` : ''}`}
                    >
                      {d.getDate()}
                    </button>

                    {visiveis.map(ag => (
                      <button
                        key={ag.id}
                        type="button"
                        className={`ag-mes__chip ${CLASSE_STATUS[ag.status]}`}
                        title={`${ag.horaInicio} · ${ag.titulo || 'Agendamento'} — ${ag.cliente}`}
                        onClick={e => { e.stopPropagation(); onCardClick(ag); }}
                      >
                        <span className="ag-mes__chip-hora">{ag.horaInicio}</span>
                        <span className="ag-mes__chip-texto">{ag.cliente}</span>
                      </button>
                    ))}

                    {resto > 0 && (
                      <button
                        type="button"
                        className="ag-mes__mais"
                        onClick={e => { e.stopPropagation(); onDayClick(d); }}
                      >
                        +{resto} {resto === 1 ? 'agendamento' : 'agendamentos'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

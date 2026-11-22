import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useHorarioFuncionamento } from '../../../hooks/useHorarioFuncionamento';
import { toISODate, WEEKDAYS_SHORT } from '../../../utils/agenda';
import type { Agendamento } from '../../../types/agendamento';
import { APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import { IcCalendario } from './icones';
import {
  CLASSE_STATUS,
  LINHAS_POR_HORA,
  plural,
  posicionarEventosDoDia,
} from './agendamentosDesktopUtils';

interface AgendaGradeProps {
  /** 1 dia (visão Dia) ou os dias da semana (visão Semana). */
  dias: Date[];
  agendamentos: Agendamento[];
  onCardClick: (ag: Agendamento) => void;
  /** Clicar no cabeçalho do dia abre a visão Dia (só na Semana). */
  onDayClick?: (d: Date) => void;
}

/**
 * Grade de horários — visões Dia e Semana.
 * Grid: uma coluna de horas + uma coluna por dia; cada dia é um grid de linhas de 15 min
 * e cada agendamento ocupa linhas (grid-row) e subcolunas (grid-column) — sem position:absolute.
 */
export function AgendaGrade({ dias, agendamentos, onCardClick, onDayClick }: AgendaGradeProps) {
  const { agendaHours: horas } = useHorarioFuncionamento();
  const aberturaMin = horas[0] * 60;
  const totalLinhas = horas.length * LINHAS_POR_HORA;

  // Atualiza a linha "agora" a cada minuto.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const hojeISO = toISODate(agora);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const colunasPorDia = useMemo(() => {
    const porData = new Map<string, Agendamento[]>();
    dias.forEach(d => porData.set(toISODate(d), []));
    agendamentos.forEach(ag => porData.get(ag.data)?.push(ag));
    return dias.map(d => {
      const iso = toISODate(d);
      return { d, iso, ...posicionarEventosDoDia(porData.get(iso) ?? [], aberturaMin, horas.length) };
    });
  }, [dias, agendamentos, aberturaMin, horas.length]);

  const foraDoHorario = colunasPorDia.reduce((n, c) => n + c.fora, 0);
  const modoDia = dias.length === 1;

  const estiloGrade = {
    '--ag-ncols': dias.length,
    '--ag-nhoras': horas.length,
    '--ag-nlinhas': totalLinhas,
  } as CSSProperties;

  return (
    <div className="ag-card">
      <div className="ag-grade" style={estiloGrade} role="group" aria-label={modoDia ? 'Agenda do dia' : 'Agenda da semana'}>
        <div className="ag-grade__cab">
          <div className="ag-grade__canto" />
          {colunasPorDia.map(({ d, iso }) => {
            const hoje = iso === hojeISO;
            const rotulo = `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}${hoje ? ' · hoje' : ''}`;
            const classe = `ag-dia-cab${hoje ? ' ag-dia-cab--hoje' : ''}${onDayClick && !modoDia ? ' ag-dia-cab--botao' : ''}`;
            return onDayClick && !modoDia ? (
              <button key={iso} type="button" className={classe} onClick={() => onDayClick(d)} aria-label={`Abrir ${rotulo}`}>
                {rotulo}
              </button>
            ) : (
              <div key={iso} className={classe}>{rotulo}</div>
            );
          })}
        </div>

        <div className="ag-grade__corpo">
          <div className="ag-horas" aria-hidden="true">
            {horas.map(h => (
              <div key={h} className="ag-hora">{String(h).padStart(2, '0')}:00</div>
            ))}
          </div>

          {colunasPorDia.map(({ iso, eventos, colunas }) => {
            const hoje = iso === hojeISO;
            const relAgora = minutosAgora - aberturaMin;
            const mostrarAgora = hoje && relAgora >= 0 && relAgora < horas.length * 60;
            const linhaAgora = Math.floor(relAgora / (60 / LINHAS_POR_HORA)) + 1;
            const fracao = (relAgora % (60 / LINHAS_POR_HORA)) / (60 / LINHAS_POR_HORA);

            return (
              <div
                key={iso}
                className={`ag-dia${colunas > 1 ? ' ag-dia--multi' : ''}`}
                style={{ '--ag-subcolunas': colunas } as CSSProperties}
              >
                {eventos.map(({ ag, linha, span, colIni, colSpan }) => {
                  const status = APPOINTMENT_STATUS_CONFIG[ag.status].label;
                  const titulo = ag.titulo || 'Agendamento';
                  const sub = [ag.cliente, ag.placa].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      className={`ag-evento ${CLASSE_STATUS[ag.status]}${span <= 2 ? ' ag-evento--curto' : ''}`}
                      style={{ gridRow: `${linha} / span ${span}`, gridColumn: `${colIni} / span ${colSpan}` }}
                      title={`${titulo} — ${ag.cliente} · ${ag.horaInicio} às ${ag.horaFim} · ${status}`}
                      aria-label={`${titulo}, ${ag.cliente}, placa ${ag.placa}, ${ag.horaInicio} às ${ag.horaFim}, ${status}`}
                      onClick={() => onCardClick(ag)}
                    >
                      <span className="ag-evento__titulo">{titulo}</span>
                      <span className="ag-evento__sub">{sub}</span>
                    </button>
                  );
                })}

                {mostrarAgora && (
                  <div
                    className="ag-agora"
                    aria-hidden="true"
                    style={{ gridRow: linhaAgora, marginTop: `calc(var(--ag-linha) * ${fracao})` }}
                  />
                )}

                {modoDia && eventos.length === 0 && (
                  <div className="ag-dia__vazio">
                    {IcCalendario}
                    <span>Nenhum agendamento neste dia</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {foraDoHorario > 0 && (
        <p className="ag-nota" role="note">
          {foraDoHorario} {plural(foraDoHorario, 'agendamento está', 'agendamentos estão')} fora do horário de funcionamento e{' '}
          {plural(foraDoHorario, 'não aparece', 'não aparecem')} na grade. Use a busca para encontrar
          {plural(foraDoHorario, ' esse agendamento', ' esses agendamentos')}.
        </p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useHorarioFuncionamento } from '../../../../hooks/useHorarioFuncionamento';
import { toISODate } from '../../../../utils/agenda';
import type { Agendamento } from '../../../../types/agendamento';
import { APPOINTMENT_STATUS_CONFIG } from '../StatusBadge';
import {
  CLASSE_STATUS,
  LINHAS_POR_HORA,
  plural,
  posicionarEventosDoDia,
} from '../agendamentosDesktopUtils';

interface MobileGradeDiaProps {
  dia: Date;
  /** Já filtrados; a grade só usa os do `dia`. */
  agendamentos: Agendamento[];
  onCardClick: (ag: Agendamento) => void;
}

/**
 * Grade de horários da visão Dia no celular — a mesma ideia de AgendaGrade (desktop):
 * um grid de linhas de 15 min, e cada agendamento ocupa linhas (grid-row) e subcolunas
 * (grid-column), sem position:absolute. O posicionamento vem de posicionarEventosDoDia.
 * Cada linha mede 24 px (96 px por hora) para o bloco de 30 min ainda ter 44 px de toque.
 */
export function MobileGradeDia({ dia, agendamentos, onCardClick }: MobileGradeDiaProps) {
  const { agendaHours: horas } = useHorarioFuncionamento();
  const aberturaMin = (horas[0] ?? 8) * 60;
  const totalLinhas = horas.length * LINHAS_POR_HORA;
  const iso = toISODate(dia);

  // Linha "agora": atualiza a cada minuto, só quando o dia aberto é hoje.
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (iso !== toISODate(new Date())) return;
    setAgora(new Date());
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  const { eventos, colunas, fora } = useMemo(
    () => posicionarEventosDoDia(agendamentos.filter(a => a.data === iso), aberturaMin, horas.length),
    [agendamentos, iso, aberturaMin, horas.length],
  );

  const minutosPorLinha = 60 / LINHAS_POR_HORA;
  const relAgora = agora.getHours() * 60 + agora.getMinutes() - aberturaMin;
  const mostrarAgora = iso === toISODate(agora) && relAgora >= 0 && relAgora < horas.length * 60;
  const linhaAgora = Math.floor(relAgora / minutosPorLinha) + 1;
  const fracaoAgora = (relAgora % minutosPorLinha) / minutosPorLinha;

  const estilo = { '--agm-nhoras': horas.length, '--agm-nlinhas': totalLinhas } as CSSProperties;

  return (
    <>
      <div className="agm-grade-wrap">
        <div className="agm-grade" style={estilo} role="group" aria-label="Agenda do dia">
          <div className="agm-horas" aria-hidden="true">
            {horas.map(h => (
              <div key={h} className="agm-hora">{String(h).padStart(2, '0')}:00</div>
            ))}
          </div>

          <div
            className={`agm-dia${colunas > 1 ? ' agm-dia--multi' : ''}`}
            style={{ '--agm-subcolunas': colunas } as CSSProperties}
          >
            {eventos.map(({ ag, linha, span, colIni, colSpan }) => {
              const status = APPOINTMENT_STATUS_CONFIG[ag.status].label;
              const titulo = ag.titulo || 'Agendamento';
              const sub = [ag.cliente, ag.veiculo, ag.placa].filter(Boolean).join(' · ');
              const tamanho = span <= 2 ? 'curto' : span === 3 ? 'medio' : 'cheio';
              return (
                <button
                  key={ag.id}
                  type="button"
                  className={`agm-evento agm-evento--${tamanho} ${CLASSE_STATUS[ag.status]}`}
                  style={{ gridRow: `${linha} / span ${span}`, gridColumn: `${colIni} / span ${colSpan}` }}
                  aria-label={`${titulo}, ${ag.cliente}, placa ${ag.placa}, ${ag.horaInicio} às ${ag.horaFim}, ${status}`}
                  onClick={() => onCardClick(ag)}
                >
                  <span className="agm-evento__hora">{ag.horaInicio}</span>
                  <span className="agm-evento__corpo">
                    <span className="agm-evento__titulo">{titulo}</span>
                    {sub && <span className="agm-evento__sub">{sub}</span>}
                    {tamanho === 'cheio' && (
                      <span className="ag-selo agm-evento__selo">
                        <span className="ag-selo__ponto" aria-hidden="true" />
                        <span>{status}</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {mostrarAgora && (
              <div
                className="agm-agora"
                aria-hidden="true"
                style={{ gridRow: linhaAgora, marginTop: `calc(var(--agm-linha) * ${fracaoAgora} - 4px)` }}
              />
            )}
          </div>
        </div>
      </div>

      {fora > 0 && (
        <p className="agm-nota" role="note">
          {fora} {plural(fora, 'agendamento está', 'agendamentos estão')} fora do horário de funcionamento e{' '}
          {plural(fora, 'não aparece', 'não aparecem')} na grade. Use a busca para encontrar{' '}
          {plural(fora, 'esse agendamento', 'esses agendamentos')}.
        </p>
      )}
    </>
  );
}

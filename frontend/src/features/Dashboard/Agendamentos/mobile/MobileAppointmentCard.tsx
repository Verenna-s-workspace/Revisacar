import { Placa } from '../../Placa';
import type { Agendamento } from '../../../../types/agendamento';
import { APPOINTMENT_STATUS_CONFIG } from '../StatusBadge';
import { CLASSE_STATUS, dataCurta } from '../agendamentosDesktopUtils';
import { IcCalendario, IcCarro, IcRelogio } from '../icones';

interface MobileAppointmentCardProps {
  agendamento: Agendamento;
  onClick: () => void;
  /** Mostra a data (dd/mm/aaaa) antes do horário — na lista de busca/filtros. Nos grupos por dia ela já está no título. */
  mostrarData?: boolean;
}

/**
 * Linha da lista no celular — a mesma da lista do desktop (AgendamentoLinha), empilhada em 2 linhas:
 * moldura com ícone de carro · serviço e "cliente · veículo" · placa, e embaixo data, horário e status.
 * Linhas mais altas que as de Estoque e Veículos (mín. 104 px). Tudo em Flexbox.
 */
export function MobileAppointmentCard({ agendamento: ag, onClick, mostrarData = false }: MobileAppointmentCardProps) {
  const status = APPOINTMENT_STATUS_CONFIG[ag.status].label;
  const titulo = ag.titulo || 'Agendamento';
  const sub = [ag.cliente, ag.veiculo].filter(Boolean).join(' · ');

  return (
    <div
      className="agm-linha"
      role="button"
      tabIndex={0}
      aria-label={`Abrir agendamento: ${titulo}, ${ag.cliente}, placa ${ag.placa}, ${dataCurta(ag.data)} às ${ag.horaInicio}, ${status}`}
      onClick={onClick}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      <div className="agm-linha__topo">
        <span className="agm-foto" aria-hidden="true">{IcCarro}</span>

        <div className="agm-linha__principal">
          <span className="agm-linha__titulo">{titulo}</span>
          {sub && <span className="agm-linha__sub">{sub}</span>}
        </div>

        <div className="agm-linha__placa"><Placa placa={ag.placa} /></div>
      </div>

      <div className="agm-linha__base">
        {mostrarData && <span className="agm-meta">{IcCalendario}{dataCurta(ag.data)}</span>}
        <span className="agm-meta agm-meta--hora">{IcRelogio}{ag.horaInicio} – {ag.horaFim}</span>
        <span className={`ag-selo agm-linha__selo ${CLASSE_STATUS[ag.status]}`}>
          <span className="ag-selo__ponto" aria-hidden="true" />
          <span>{status}</span>
        </span>
      </div>
    </div>
  );
}

import type { CSSProperties, JSX } from 'react';
import { Icons } from '../../Icons';
import { AgendaIcons } from '../icons';
import { Skeleton } from '../../Primitives';
import { MOBILE_STATUS } from './statusTheme';
import type { AgendamentoStats } from '../../../../hooks/useAgendamentos';

interface StatDef {
  key: keyof AgendamentoStats;
  label: string;
  icon: JSX.Element;
  fg: string;
  bg: string;
}

const STAT_DEFS: StatDef[] = [
  { key: 'hoje',                label: 'Hoje',       icon: Icons.cal,                 fg: '#C82319', bg: '#FEE2E2' },
  { key: 'emAndamento',         label: 'Andamento',  icon: AgendaIcons.sync,          fg: MOBILE_STATUS.em_andamento.fg,         bg: MOBILE_STATUS.em_andamento.bg },
  { key: 'concluidos',          label: 'Concluídos', icon: AgendaIcons.checkCircle,   fg: MOBILE_STATUS.concluido.fg,            bg: MOBILE_STATUS.concluido.bg },
  { key: 'aguardandoPagamento', label: 'Pagamento',  icon: AgendaIcons.dollarCircle,  fg: MOBILE_STATUS.aguardando_pagamento.fg, bg: MOBILE_STATUS.aguardando_pagamento.bg },
  { key: 'cancelados',          label: 'Cancelados', icon: AgendaIcons.xCircle,       fg: MOBILE_STATUS.cancelado.fg,            bg: MOBILE_STATUS.cancelado.bg },
];

interface MobileStatsRailProps {
  stats: AgendamentoStats;
  loading?: boolean;
}

export function MobileStatsRail({ stats, loading }: MobileStatsRailProps) {
  return (
    <section className="agm-stats" aria-label="Resumo dos agendamentos">
      <div className="agm-stats__rail">
        {STAT_DEFS.map(d => (
          <div key={d.key} className="agm-stat">
            <span
              className="agm-stat__icon"
              style={{ '--ic-fg': d.fg, '--ic-bg': d.bg } as CSSProperties}
              aria-hidden="true"
            >
              {d.icon}
            </span>
            <div>
              {loading
                ? <Skeleton w={22} h={22} r={4} />
                : <span className="agm-stat__num">{stats[d.key]}</span>}
              <span className="agm-stat__label">{d.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

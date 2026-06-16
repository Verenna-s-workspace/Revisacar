import type { JSX } from 'react';
import { tokens } from '../../../constants';
import { Card, Skeleton } from '../Primitives';
import { Icons } from '../Icons';
import { useResponsive } from '../../../components/ui';
import { AgendaIcons } from './icons';
import type { AgendamentoStats } from '../../../hooks/useAgendamentos';

interface StatDef {
  key: keyof AgendamentoStats;
  label: string;
  icon: JSX.Element;
  color: string;
  bg: string;
  scale?: number;
}

const STAT_DEFS: StatDef[] = [
  { key: 'hoje', label: 'Agendamentos Hoje', icon: Icons.cal, color: tokens.color.ferrari, bg: tokens.color.ferrariMid },
  { key: 'emAndamento', label: 'Em Andamento', icon: AgendaIcons.sync, color: '#E65100', bg: '#FFF3E0', scale: 1.35 },
  { key: 'aguardandoPagamento', label: 'Aguardando Pagamento', icon: AgendaIcons.dollarCircle, color: '#1565C0', bg: '#E3F2FD', scale: 1.35 },
  { key: 'concluidos', label: 'Concluídos', icon: AgendaIcons.checkCircle, color: '#2E7D32', bg: '#E8F5E9', scale: 1.35 },
  { key: 'cancelados', label: 'Cancelados', icon: AgendaIcons.xCircle, color: tokens.color.crit, bg: tokens.color.critBg, scale: 1.35 },
];

interface AppointmentStatsProps {
  stats: AgendamentoStats;
  loading?: boolean;
}

export function AppointmentStats({ stats, loading }: AppointmentStatsProps) {
  const { isMobile, isTablet } = useResponsive();
  const columns = isMobile ? 2 : isTablet ? 3 : 5;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: isMobile ? 10 : 14 }}>
      {STAT_DEFS.map(d => (
        <Card key={d.key} style={{ padding: isMobile ? '12px 12px' : '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: d.bg, color: d.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ display: 'flex', transform: d.scale ? `scale(${d.scale})` : undefined }}>
                {d.icon}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              {loading ? (
                <Skeleton w={28} h={22} r={4} />
              ) : (
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: tokens.color.text, lineHeight: 1.1 }}>
                  {stats[d.key]}
                </div>
              )}
              <div
                style={{
                  fontSize: '0.64rem', fontWeight: 700, color: tokens.color.muted,
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {d.label}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

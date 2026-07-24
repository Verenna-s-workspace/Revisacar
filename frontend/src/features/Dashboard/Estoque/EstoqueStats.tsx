import type { JSX } from 'react';
import { tokens } from '../../../constants';
import { Card, Skeleton } from '../Primitives';
import { Icons } from '../Icons';
import { useResponsive } from '../../../components/ui';
import { formatBRL } from '../../../utils/dashboard';
import type { EstoqueStats as EstoqueStatsData } from '../../../hooks/useEstoque';

interface StatDef {
  key: keyof EstoqueStatsData;
  label: string;
  icon: JSX.Element;
  color: string;
  bg: string;
  format?: (v: number) => string;
}

const STAT_DEFS: StatDef[] = [
  { key: 'totalItens',        label: 'Itens Cadastrados', icon: Icons.box,    color: tokens.color.ferrari, bg: tokens.color.ferrariMid },
  { key: 'valorTotal',        label: 'Valor em Estoque',  icon: Icons.dollar, color: '#2E7D32',             bg: '#E8F5E9', format: formatBRL },
  { key: 'itensBaixoEstoque', label: 'Estoque Baixo',     icon: Icons.alert,  color: tokens.color.warn,     bg: tokens.color.warnBg },
  { key: 'kitsDisponiveis',   label: 'Kits Disponíveis',  icon: Icons.check,  color: tokens.color.ok,       bg: tokens.color.okBg },
];

interface EstoqueStatsProps {
  stats: EstoqueStatsData;
  loading?: boolean;
}

export function EstoqueStats({ stats, loading }: EstoqueStatsProps) {
  const { isMobile, isTablet } = useResponsive();
  const columns = isMobile ? 2 : isTablet ? 2 : 4;

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
              {d.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              {loading ? (
                <Skeleton w={40} h={22} r={4} />
              ) : (
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: tokens.color.text, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  {d.format ? d.format(stats[d.key]) : stats[d.key]}
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

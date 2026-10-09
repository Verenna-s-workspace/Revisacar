import {
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { FaturamentoDia } from '../../types/dashboard';
import { formatBRL } from '../../utils/dashboard';

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, formato }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#CC1400',
      color: 'white',
      borderRadius: 9,
      padding: '7px 13px',
      boxShadow: '0 4px 16px rgba(204,20,0,0.3)',
      border: 'none',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
        {formato === 'numero' ? `${payload[0].value} ${payload[0].value === 1 ? 'ordem' : 'ordens'}` : formatBRL(payload[0].value)}
      </div>
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────

interface FaturamentoChartProps {
  data: FaturamentoDia[];
  height?: number;
  /** 'moeda' (padrão): `valor` é faturamento em R$. 'numero': `valor` é quantidade (quem não vê dinheiro). */
  formato?: 'moeda' | 'numero';
}

/** Rótulo do eixo Y: 0, 480, 1,5 mil, 12 mil. (Antes: `${v/1000}.000` → "0.48.000" pra valores pequenos.) */
function rotuloEixoY(v: number, formato: 'moeda' | 'numero'): string {
  if (formato === 'numero' || v < 1000) return String(v);
  return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
}

export function FaturamentoChart({ data, height = 220, formato = 'moeda' }: FaturamentoChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart
        data={data}
        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fatGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CC1400" stopOpacity={0.22} />
            <stop offset="80%" stopColor="#CC1400" stopOpacity={0.03} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 0"
          stroke="#E5E2DA"
          strokeWidth={0.7}
          vertical={false}
        />

        <XAxis
          dataKey="dia"
          tick={{ fontSize: 10, fontFamily: 'DM Sans, sans-serif', fill: '#9A958C' }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />

        <YAxis
          tick={{ fontSize: 10, fontFamily: 'DM Sans, sans-serif', fill: '#9A958C' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => rotuloEixoY(v, formato)}
          allowDecimals={false}
          domain={[0, 'auto']}
          width={52}
        />

        <Tooltip
          content={<CustomTooltip formato={formato} />}
          cursor={{ stroke: '#CC1400', strokeWidth: 0.8, strokeDasharray: '3 2' }}
        />

        <Area
          type="monotone"
          dataKey="valor"
          stroke="#CC1400"
          strokeWidth={2.2}
          fill="url(#fatGradient)"
          dot={false}
          activeDot={{
            r: 5,
            fill: '#CC1400',
            stroke: 'white',
            strokeWidth: 2,
          }}
          animationDuration={1200}
          animationEasing="ease-out"
        />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

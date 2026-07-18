import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tokens } from '../../../constants';
import { formatarNumero } from '../../../utils/relatorios';
import type { PontoSerieTemporal } from '../../../types/relatorios';

function TooltipOrdens({ active, label, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 10,
        boxShadow: tokens.shadow.md,
        padding: '10px 12px',
        fontSize: '0.78rem',
        fontFamily: tokens.fontSans,
      }}
    >
      <div style={{ fontWeight: 700, color: tokens.color.text, marginBottom: 4 }}>{label}</div>
      {payload.map((item: any) =>
        item.value === null || item.value === undefined ? null : (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, color: tokens.color.textSecond }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            {item.name}: <strong style={{ color: tokens.color.text }}>{formatarNumero(item.value)} OS</strong>
          </div>
        )
      )}
    </div>
  );
}

interface OrdensComparativoChartProps {
  dados: PontoSerieTemporal[];
  height: number;
}

export function OrdensComparativoChart({ dados, height }: OrdensComparativoChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={dados} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.color.border} vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: tokens.color.muted }} axisLine={false} tickLine={false} />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: tokens.color.muted }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip content={<TooltipOrdens />} cursor={{ fill: 'rgba(204,20,0,0.08)' }} />
        <Legend wrapperStyle={{ fontSize: '0.72rem' }} iconType="circle" iconSize={8} />
        <Bar dataKey="atual" name="Período atual" fill={tokens.color.ferrari} radius={[6, 6, 0, 0]} animationDuration={700} maxBarSize={34} />
        <Bar dataKey="anterior" name="Período anterior" fill={tokens.color.borderMd} radius={[6, 6, 0, 0]} animationDuration={700} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { tokens } from '../../../constants';
import { formatBRL } from '../../../utils/dashboard';
import type { PontoSerieTemporal } from '../../../types/relatorios';

function formatarEixoY(valor: number): string {
  if (Math.abs(valor) >= 1000) return `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mil`;
  return String(valor);
}

function TooltipFaturamento({ active, label, payload }: any) {
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
            {item.name}: <strong style={{ color: tokens.color.text }}>{formatBRL(item.value)}</strong>
          </div>
        )
      )}
    </div>
  );
}

interface FaturamentoComparativoChartProps {
  dados: PontoSerieTemporal[];
  height: number;
}

export function FaturamentoComparativoChart({ dados, height }: FaturamentoComparativoChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={dados} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.color.border} vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: tokens.color.muted }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={formatarEixoY}
          tick={{ fontSize: 11, fill: tokens.color.muted }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip content={<TooltipFaturamento />} cursor={{ stroke: tokens.color.border }} />
        <Legend wrapperStyle={{ fontSize: '0.72rem' }} iconType="circle" iconSize={8} />
        <Line
          type="monotone"
          dataKey="atual"
          name="Período atual"
          stroke={tokens.color.ferrari}
          strokeWidth={2.5}
          dot={{ r: 3, strokeWidth: 0, fill: tokens.color.ferrari }}
          activeDot={{ r: 5 }}
          connectNulls
          animationDuration={700}
        />
        <Line
          type="monotone"
          dataKey="anterior"
          name="Período anterior"
          stroke={tokens.color.subtle}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 3, strokeWidth: 0, fill: tokens.color.subtle }}
          connectNulls
          animationDuration={700}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatBRL } from '../../../utils/dashboard';

export interface FluxoDia {
  dia: string;
  entradas: number;
  saidas: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#CC1400',
      color: 'white',
      borderRadius: 9,
      padding: '8px 13px',
      boxShadow: '0 4px 16px rgba(204,20,0,0.3)',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{ fontSize: '0.65rem', opacity: 0.85, marginBottom: 3 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ opacity: 0.85, fontWeight: 500 }}>{p.dataKey === 'entradas' ? 'Entradas' : 'Saídas'}</span>
          <span>{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FluxoCaixaChart({ data, height = 240 }: { data: FluxoDia[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="entradasGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CC1400" stopOpacity={0.22} />
            <stop offset="80%" stopColor="#CC1400" stopOpacity={0.03} />
          </linearGradient>
          <linearGradient id="saidasGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B35C00" stopOpacity={0.18} />
            <stop offset="80%" stopColor="#B35C00" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 0" stroke="#E5E2DA" strokeWidth={0.7} vertical={false} />

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
          tickFormatter={(v) => v === 0 ? '0' : `${v / 1000}k`}
          domain={[0, 'auto']}
          width={38}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#CC1400', strokeWidth: 0.8, strokeDasharray: '3 2' }} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: '0.74rem', fontFamily: 'DM Sans, sans-serif', color: '#6B6760' }}>
              {value === 'entradas' ? 'Entradas' : 'Saídas'}
            </span>
          )}
        />

        <Area type="monotone" dataKey="entradas" stroke="#CC1400" strokeWidth={2.2} fill="url(#entradasGradient)" dot={false} activeDot={{ r: 5, fill: '#CC1400', stroke: 'white', strokeWidth: 2 }} animationDuration={900} />
        <Area type="monotone" dataKey="saidas" stroke="#B35C00" strokeWidth={2} fill="url(#saidasGradient)" dot={false} activeDot={{ r: 5, fill: '#B35C00', stroke: 'white', strokeWidth: 2 }} animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

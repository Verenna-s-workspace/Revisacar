import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatBRL } from '../../../utils/dashboard';
import { formatarNumero } from '../../../utils/relatorios';
import type { PontoSerieTemporal } from '../../../types/relatorios';

const COR_ATUAL = 'var(--rel-serie-atual)';
const COR_ANTERIOR = 'var(--rel-serie-anterior)';

const EIXO_BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function TooltipComparativo({
  active,
  label,
  payload,
  formatar,
}: TooltipProps<number, string> & { formatar: (valor: number) => string }) {
  if (!active || !payload?.length) return null;
  const itens = payload.filter((item) => item.value !== null && item.value !== undefined);
  if (itens.length === 0) return null;

  return (
    <div className='rel-tooltip'>
      <span className='rel-tooltip__titulo'>{label}</span>
      {itens.map((item, idx) => (
        <span key={String(item.dataKey ?? item.name ?? idx)} className='rel-tooltip__linha'>
          <i
            className='rel-legenda__marca'
            style={{ background: item.dataKey === 'atual' ? COR_ATUAL : COR_ANTERIOR }}
          />
          {item.name}
          <strong>{formatar(Number(item.value))}</strong>
        </span>
      ))}
    </div>
  );
}

export function FaturamentoGraficoDesktop({
  dados,
  height = 224,
}: {
  dados: PontoSerieTemporal[];
  height?: number;
}) {
  return (
    <>
      <div className='rel-legenda' aria-hidden='true'>
        <span className='rel-legenda__item'>
          <i className='rel-legenda__marca' style={{ background: COR_ATUAL }} />
          Período atual
        </span>
        <span className='rel-legenda__item'>
          <i className='rel-legenda__marca' style={{ background: COR_ANTERIOR }} />
          Período anterior
        </span>
      </div>
      <div className='rel-grafico' style={{ height }}>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke='var(--rel-borda)' strokeDasharray='3 3' />
            <XAxis
              dataKey='rotulo'
              tickLine={false}
              axisLine={{ stroke: 'var(--rel-borda)' }}
              tick={{ fontSize: 12, fill: 'var(--rel-mudo)' }}
              interval='preserveStartEnd'
              minTickGap={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              tick={{ fontSize: 12, fill: 'var(--rel-mudo)' }}
              tickFormatter={(v: number) => EIXO_BRL.format(v).replace(/\s/g, ' ')}
            />
            <Tooltip
              content={<TooltipComparativo formatar={formatBRL} />}
              cursor={{ stroke: 'var(--rel-borda-forte)' }}
            />
            <Line
              type='monotone'
              dataKey='atual'
              name='Período atual'
              stroke={COR_ATUAL}
              strokeWidth={2.25}
              dot={{ r: 3, strokeWidth: 0, fill: COR_ATUAL }}
              activeDot={{ r: 5 }}
              connectNulls
              animationDuration={700}
            />
            <Line
              type='monotone'
              dataKey='anterior'
              name='Período anterior'
              stroke={COR_ANTERIOR}
              strokeWidth={2}
              strokeDasharray='5 4'
              dot={{ r: 3, strokeWidth: 0, fill: COR_ANTERIOR }}
              connectNulls
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function OrdensGraficoDesktop({
  dados,
  height = 224,
}: {
  dados: PontoSerieTemporal[];
  height?: number;
}) {
  return (
    <>
      <div className='rel-legenda' aria-hidden='true'>
        <span className='rel-legenda__item'>
          <i className='rel-legenda__marca' style={{ background: COR_ATUAL }} />
          Período atual
        </span>
        <span className='rel-legenda__item'>
          <i className='rel-legenda__marca' style={{ background: COR_ANTERIOR }} />
          Período anterior
        </span>
      </div>
      <div className='rel-grafico' style={{ height }}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap='28%'>
            <CartesianGrid vertical={false} stroke='var(--rel-borda)' strokeDasharray='3 3' />
            <XAxis
              dataKey='rotulo'
              tickLine={false}
              axisLine={{ stroke: 'var(--rel-borda)' }}
              tick={{ fontSize: 12, fill: 'var(--rel-mudo)' }}
              interval='preserveStartEnd'
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 12, fill: 'var(--rel-mudo)' }}
            />
            <Tooltip
              content={<TooltipComparativo formatar={(v) => `${formatarNumero(v)} OS`} />}
              cursor={{ fill: 'var(--rel-surface-high)', opacity: 0.6 }}
            />
            <Bar
              dataKey='atual'
              name='Período atual'
              fill={COR_ATUAL}
              maxBarSize={18}
              radius={[4, 4, 0, 0]}
              animationDuration={700}
            />
            <Bar
              dataKey='anterior'
              name='Período anterior'
              fill={COR_ANTERIOR}
              maxBarSize={18}
              radius={[4, 4, 0, 0]}
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
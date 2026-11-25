import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatBRL } from '../../../utils/dashboard';
import { Valor, GraficoPrivado } from '../../../components/Privacidade';
import type { PontoFluxo } from '../../../utils/financeiro_utils';

const EIXO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

const COR_ENTRADAS = 'var(--fin-entradas)';
const COR_SAIDAS = 'var(--fin-saidas)';

function Dica({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload as PontoFluxo;
  return (
    <div className="fin-tooltip">
      <span className="fin-tooltip__titulo">{ponto.detalhe}</span>
      <span className="fin-tooltip__linha">
        <i className="fin-legenda__marca" style={{ background: COR_ENTRADAS }} /> Entradas
        <strong><Valor texto={formatBRL(ponto.entradas)} /></strong>
      </span>
      <span className="fin-tooltip__linha">
        <i className="fin-legenda__marca" style={{ background: COR_SAIDAS }} /> Saídas
        <strong><Valor texto={formatBRL(ponto.saidas)} /></strong>
      </span>
    </div>
  );
}

/** Entradas × saídas por dia/semana/mês. Um eixo só, barras finas com topo arredondado, legenda fora do gráfico. */
export function FluxoCaixaBarras({ pontos }: { pontos: PontoFluxo[] }) {
  return (
    <>
      <div className="fin-legenda" aria-hidden="true">
        <span className="fin-legenda__item"><i className="fin-legenda__marca" style={{ background: COR_ENTRADAS }} />Entradas</span>
        <span className="fin-legenda__item"><i className="fin-legenda__marca" style={{ background: COR_SAIDAS }} />Saídas</span>
      </div>
      <GraficoPrivado style={{ height: 220 }}>
        <div className="fin-grafico" role="img" aria-label="Gráfico de barras de entradas e saídas no período">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--fin-borda)" strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: 'var(--fin-borda)' }} tick={{ fontSize: 12, fill: 'var(--fin-mudo)' }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} width={76} tick={{ fontSize: 12, fill: 'var(--fin-mudo)' }} tickFormatter={(v: number) => EIXO.format(v).replace(/\s/g, ' ')} />
              <Tooltip content={<Dica />} cursor={{ fill: 'var(--fin-surface-high)', opacity: 0.6 }} />
              <Bar dataKey="entradas" name="Entradas" fill={COR_ENTRADAS} maxBarSize={18} radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill={COR_SAIDAS} maxBarSize={18} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GraficoPrivado>
    </>
  );
}

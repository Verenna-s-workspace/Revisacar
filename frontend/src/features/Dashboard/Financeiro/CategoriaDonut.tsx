import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { tokens } from '../../../constants';
import { formatBRL } from '../../../utils/dashboard';
import { labelCategoria, PALETA_DONUT } from './categoriaLabels';

export interface FatiaCategoria {
  categoria: string;
  valor: number;
}

export function CategoriaDonut({ dados }: { dados: FatiaCategoria[] }) {
  const ordenado = [...dados].sort((a, b) => b.valor - a.valor);
  const total = ordenado.reduce((s, d) => s + d.valor, 0);

  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: tokens.color.muted, fontSize: '0.82rem' }}>
        Sem despesas registradas nesse período.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ width: 150, height: 150, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ordenado}
              dataKey="valor"
              nameKey="categoria"
              innerRadius={44}
              outerRadius={68}
              paddingAngle={2}
              animationDuration={800}
            >
              {ordenado.map((_, i) => (
                <Cell key={i} fill={PALETA_DONUT[i % PALETA_DONUT.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatBRL(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ordenado.slice(0, 6).map((d, i) => (
          <div key={d.categoria} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: PALETA_DONUT[i % PALETA_DONUT.length], flexShrink: 0 }} />
              <span style={{ color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {labelCategoria('saida', d.categoria)}
              </span>
            </div>
            <span style={{ color: tokens.color.muted, fontWeight: 700, flexShrink: 0 }}>{formatBRL(d.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

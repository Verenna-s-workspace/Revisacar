import { tokens } from '../../../constants';
import { Icons, CATEGORIA_ICON } from '../Icons';
import { ProgressBar } from '../Primitives';
import type { ItemEstoqueMovimentado } from '../../../types/estoque';

interface ItensEstoqueMaisMovimentadosChartProps {
  dados: ItemEstoqueMovimentado[];
}

export function ItensEstoqueMaisMovimentadosChart({ dados }: ItensEstoqueMaisMovimentadosChartProps) {
  const maiorQuantidade = Math.max(...dados.map(d => d.quantidade), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dados.map((item, i) => {
        const pct = (item.quantidade / maiorQuantidade) * 100;
        return (
          <div key={item.nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: i === 0 ? tokens.color.ferrari : tokens.color.ferrariMid,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: i === 0 ? 'white' : tokens.color.ferrari,
                flexShrink: 0,
              }}
            >
              {CATEGORIA_ICON[item.categoria] ?? Icons.box}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: tokens.color.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.nome}
                </span>
                <span style={{ fontSize: '0.78rem', color: tokens.color.muted, flexShrink: 0 }}>
                  {item.quantidade} un. · {item.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </span>
              </div>
              <ProgressBar pct={pct} color={i === 0 ? tokens.color.ferrari : tokens.color.ferrariGlow} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

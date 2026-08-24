import { tokens } from '../../../constants';
import { Icons, SVC_ICON } from '../Icons';
import { ProgressBar } from '../Primitives';
import type { ServicoRealizado } from '../../../types/relatorios';

interface ServicosMaisRealizadosChartProps {
  dados: ServicoRealizado[];
}

export function ServicosMaisRealizadosChart({ dados }: ServicosMaisRealizadosChartProps) {
  const maiorQuantidade = Math.max(...dados.map((d) => d.quantidade), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {dados.map((s, i) => {
        const pct = (s.quantidade / maiorQuantidade) * 100;
        return (
          <div key={s.nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              {SVC_ICON[s.nome] ?? Icons.wrench}
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
                  {s.nome}
                </span>
                <span style={{ fontSize: '0.78rem', color: tokens.color.muted, flexShrink: 0 }}>
                  {s.quantidade} OS · {s.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
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

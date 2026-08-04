import { Card, Skeleton } from '../Primitives';
import { tokens } from '../../../constants';
import type { ResumoOperacional as ResumoOperacionalType } from '../../../hooks/useAtendimento';

interface ResumoOperacionalProps {
  resumo: ResumoOperacionalType;
  loading: boolean;
}

export function ResumoOperacional({ resumo, loading }: ResumoOperacionalProps) {
  const itens: { label: string; value: number; color: string }[] = [
    { label: 'Em Execução', value: resumo.emExecucao, color: tokens.color.ferrari },
    { label: 'Bloqueados', value: resumo.bloqueados, color: tokens.color.warn },
    { label: 'Finalizados Hoje', value: resumo.finalizadosHoje, color: tokens.color.ok },
  ];

  return (
    <Card style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex' }}>
        {itens.map((item, i) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: i > 0 ? 20 : 0,
              borderLeft: i > 0 ? `1px solid ${tokens.color.border}` : 'none',
            }}
          >
            {loading ? (
              <>
                <Skeleton w={44} h={30} r={6} />
                <div style={{ marginTop: 8 }}>
                  <Skeleton w={80} h={11} r={4} />
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {item.value}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: tokens.color.muted,
                    marginTop: 6,
                  }}
                >
                  {item.label}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

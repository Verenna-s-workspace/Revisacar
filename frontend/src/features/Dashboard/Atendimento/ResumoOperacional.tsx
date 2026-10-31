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
    <Card style={{ padding: 'clamp(14px, 4vw, 20px)' }}>
      <div style={{ display: 'flex' }}>
        {itens.map((item, i) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: i > 0 ? 'clamp(10px, 3vw, 20px)' : 0,
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
                <div style={{ fontSize: 'clamp(1.5rem, 7vw, 1.9rem)', fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {item.value}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    // Num celular de 360px "BLOQUEADOS" passava da coluna
                    letterSpacing: '0.02em',
                    color: tokens.color.muted,
                    marginTop: 6,
                    lineHeight: 1.25,
                    overflowWrap: 'anywhere',
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

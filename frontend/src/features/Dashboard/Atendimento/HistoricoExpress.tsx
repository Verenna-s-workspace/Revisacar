import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { StatusBadge } from '../Primitives';
import { diasDesde, historicoExpressDaOrdem, possivelRetornoNaOrdem } from '../../../utils/atendimento_utils';
import type { OSAtendimento } from '../../../types/atendimento';

interface HistoricoExpressProps {
  ordem: OSAtendimento;
  todasOrdens: OSAtendimento[];
}

function formatDiasAtras(iso: string): string {
  const d = diasDesde(iso);
  if (d <= 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `${d} dias atrás`;
}

export function HistoricoExpress({ ordem, todasOrdens }: HistoricoExpressProps) {
  const historico = historicoExpressDaOrdem(ordem, todasOrdens);
  if (historico.length === 0) return null; // sem OS anteriores pra essa placa ainda

  const retorno = possivelRetornoNaOrdem(ordem, historico);

  return (
    <div>
      <div
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: tokens.color.muted,
          marginBottom: 10,
        }}
      >
        Histórico Express
      </div>

      {retorno && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 11px',
            borderRadius: 9,
            background: tokens.color.warnBg,
            border: `1px solid ${tokens.color.warnBorder}`,
            marginBottom: 8,
          }}
        >
          <span style={{ display: 'flex', color: tokens.color.warn, flexShrink: 0 }}>{Icons.alert}</span>
          <span style={{ fontSize: '0.78rem', color: tokens.color.warn, fontWeight: 600 }}>
            Possível retorno do serviço de {diasDesde(retorno.created_at)} dias atrás.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {historico.map(h => (
          <div
            key={h.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 11px',
              borderRadius: 8,
              background: tokens.color.surfaceHigh,
              border: `1px solid ${tokens.color.border}`,
            }}
          >
            <span style={{ fontSize: '0.78rem', color: tokens.color.textSecond }}>
              OS #{h.os_num} · {formatDiasAtras(h.created_at)}
            </span>
            <StatusBadge status={h.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

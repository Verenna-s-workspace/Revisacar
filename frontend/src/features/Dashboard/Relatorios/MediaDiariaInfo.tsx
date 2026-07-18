import { tokens } from '../../../constants';
import { Card } from '../Primitives';
import type { MediaDiaria } from '../../../types/relatorios';

function formatarMedia(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

interface MediaDiariaInfoProps {
  mediaDiaria: MediaDiaria;
}

export function MediaDiariaInfo({ mediaDiaria }: MediaDiariaInfoProps) {
  const { atual, anterior } = mediaDiaria;
  return (
    <Card style={{ padding: '12px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 18 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.muted }}>
          Média diária de OS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>{atual.rotulo}:</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: tokens.color.text }}>
            {atual.total} OS · {formatarMedia(atual.media)} OS/dia
          </span>
        </div>
        {anterior && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>{anterior.rotulo}:</span>
            <span style={{ fontSize: '0.82rem', color: tokens.color.muted }}>
              {anterior.total} OS · {formatarMedia(anterior.media)} OS/dia
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

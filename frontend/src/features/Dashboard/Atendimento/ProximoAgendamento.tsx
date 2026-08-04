import { Card, Skeleton } from '../Primitives';
import { tokens } from '../../../constants';
import type { Agendamento } from '../../../types/agendamento';

interface ProximoAgendamentoProps {
  agendamento: Agendamento | null;
  loading: boolean;
  onIniciarAtendimento: (agendamento: Agendamento) => void;
}

export function ProximoAgendamento({ agendamento, loading, onIniciarAtendimento }: ProximoAgendamentoProps) {
  return (
    <Card style={{ padding: '16px 20px' }}>
      <div
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: tokens.color.muted,
          marginBottom: 12,
        }}
      >
        Próximo Agendamento
      </div>

      {loading ? (
        <Skeleton h={44} r={8} />
      ) : !agendamento ? (
        <div style={{ fontSize: '0.85rem', color: tokens.color.muted, padding: '4px 0' }}>
          Nenhum agendamento restante pra hoje.
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                flexShrink: 0,
                minWidth: 56,
                padding: '8px 10px',
                borderRadius: 10,
                background: tokens.color.surfaceHigh,
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '0.92rem',
                color: tokens.color.text,
              }}
            >
              {agendamento.horaInicio}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>{agendamento.cliente}</div>
              <div style={{ fontSize: '0.78rem', color: tokens.color.muted, marginTop: 1 }}>
                {agendamento.veiculo} · {agendamento.placa}
              </div>
              <div style={{ fontSize: '0.78rem', color: tokens.color.textSecond, marginTop: 2 }}>{agendamento.titulo}</div>
            </div>
          </div>

          <button
            onClick={() => onIniciarAtendimento(agendamento)}
            style={{
              flexShrink: 0,
              padding: '10px 18px',
              background: tokens.color.ferrari,
              color: 'white',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Iniciar Atendimento
          </button>
        </div>
      )}
    </Card>
  );
}

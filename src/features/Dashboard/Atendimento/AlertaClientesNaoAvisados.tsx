import { Card } from '../Primitives';
import { Icons } from '../Icons';
import { tokens } from '../../../constants';
import type { OSAtendimento } from '../../../types/atendimento';

interface AlertaClientesNaoAvisadosProps {
  clientes: OSAtendimento[];
  onAbrirOS: (ordem: OSAtendimento) => void;
  /** Leva à tela de Alertas, direto no grupo de clientes para avisar (lista completa). */
  onVerMais?: () => void;
}

const MAX_VISIVEL = 4;

export function AlertaClientesNaoAvisados({ clientes, onAbrirOS, onVerMais }: AlertaClientesNaoAvisadosProps) {
  // Só renderiza se houver pelo menos 1 — ver Seção 5, item 4 do prompt.
  if (clientes.length === 0) return null;

  const visiveis = clientes.slice(0, MAX_VISIVEL);
  const restantes = clientes.length - visiveis.length;

  return (
    <Card style={{ padding: '16px 20px', background: tokens.color.ferrari, border: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span style={{ display: 'flex', color: 'white' }}>{Icons.alert}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white' }}>
          Cliente{clientes.length > 1 ? 's' : ''} Não Avisado{clientes.length > 1 ? 's' : ''}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 99,
            background: 'rgba(255,255,255,0.24)',
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {clientes.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visiveis.map(ordem => (
          <button
            key={ordem.id}
            onClick={() => onAbrirOS(ordem)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              width: '100%',
              padding: '9px 10px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ordem.cliente}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.78)', marginTop: 1 }}>
                {ordem.modelo} · {ordem.placa}
              </div>
            </div>
            <span style={{ display: 'flex', color: 'rgba(255,255,255,0.78)', flexShrink: 0 }}>{Icons.arrow}</span>
          </button>
        ))}
        {restantes > 0 && (
          // Os demais não cabem aqui: o botão abre a lista completa em Alertas.
          onVerMais ? (
            <button
              type="button"
              onClick={onVerMais}
              aria-label={`Ver mais: ${restantes} outro${restantes > 1 ? 's' : ''} cliente${restantes > 1 ? 's' : ''} não avisado${restantes > 1 ? 's' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                minHeight: 40,
                marginTop: 4,
                padding: '8px 10px',
                background: 'white',
                color: tokens.color.ferrari,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 800,
                fontFamily: tokens.fontSans,
              }}
            >
              Ver mais (+{restantes})
              <span style={{ display: 'flex' }}>{Icons.arrow}</span>
            </button>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.78)', textAlign: 'center', padding: '4px 0 0' }}>
              +{restantes} outro{restantes > 1 ? 's' : ''}
            </div>
          )
        )}
      </div>
    </Card>
  );
}

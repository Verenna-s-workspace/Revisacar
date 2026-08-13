import { tokens } from '../../../constants';
import { Card } from '../Primitives';
import { formatBRL } from '../../../utils/dashboard';
import { labelCategoria } from './categoriaLabels';
import type { Transacao } from './types';

function formatDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function Lista({ titulo, itens, corValor, onMarcarPago, podeEditar }: {
  titulo: string;
  itens: Transacao[];
  corValor: string;
  onMarcarPago?: (id: string) => void;
  podeEditar: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: tokens.color.text }}>{titulo}</span>
        <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>{itens.length} pendente{itens.length !== 1 ? 's' : ''}</span>
      </div>
      {itens.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: tokens.color.muted, fontSize: '0.8rem' }}>Nada pendente por aqui.</div>
      ) : (
        <div>
          {itens.slice(0, 6).map(t => (
            <div key={t.id} style={{ padding: '11px 18px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.descricao || labelCategoria(t.tipo, t.categoria)}
                </div>
                <div style={{ fontSize: '0.72rem', color: t.vencido ? tokens.color.crit : tokens.color.muted, fontWeight: t.vencido ? 700 : 400 }}>
                  {t.vencido ? 'Venceu em ' : 'Vence em '}{t.data_vencimento ? formatDataCurta(t.data_vencimento) : formatDataCurta(t.data_competencia)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: corValor }}>{formatBRL(t.valor)}</span>
                {podeEditar && onMarcarPago && (
                  <button
                    onClick={() => onMarcarPago(t.id)}
                    title="Marcar como pago"
                    style={{ padding: '4px 9px', fontSize: '0.68rem', fontWeight: 700, borderRadius: 6, border: `1px solid ${tokens.color.ok}`, color: tokens.color.ok, background: 'transparent', cursor: 'pointer' }}
                  >
                    Pago
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContasWidget({ aReceber, aPagar, onMarcarPago, podeEditar }: {
  aReceber: Transacao[];
  aPagar: Transacao[];
  onMarcarPago: (id: string) => void;
  podeEditar: boolean;
}) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Lista titulo="Contas a Receber" itens={aReceber} corValor={tokens.color.ok} onMarcarPago={onMarcarPago} podeEditar={podeEditar} />
        <div style={{ width: 1, background: tokens.color.border }} />
        <Lista titulo="Contas a Pagar" itens={aPagar} corValor={tokens.color.crit} onMarcarPago={onMarcarPago} podeEditar={podeEditar} />
      </div>
    </Card>
  );
}

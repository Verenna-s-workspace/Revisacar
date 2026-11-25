import { useMemo } from 'react';
import { tokens } from '../../../constants';
import { Card } from '../Primitives';
import { ContaLinha } from './ContaLinha';
import { LIMITE_WIDGET_CONTAS, ordenarPorUrgencia } from './contasUtils';
import type { Transacao } from './types';

export type TipoContas = 'receber' | 'pagar';

function Lista({ titulo, itens, corValor, onMarcarPago, podeEditar, onVerTodas }: {
  titulo: string;
  itens: Transacao[];
  corValor: string;
  onMarcarPago?: (id: string) => void;
  podeEditar: boolean;
  onVerTodas: () => void;
}) {
  // Mais urgente primeiro: sem isso, o corte nos 6 escondia as contas vencidas mais antigas.
  const ordenados = useMemo(() => ordenarPorUrgencia(itens), [itens]);
  const restantes = ordenados.length - LIMITE_WIDGET_CONTAS;

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
          {ordenados.slice(0, LIMITE_WIDGET_CONTAS).map(t => (
            <ContaLinha key={t.id} t={t} corValor={corValor} onMarcarPago={onMarcarPago} podeEditar={podeEditar} />
          ))}
          {restantes > 0 && (
            <button
              type="button"
              onClick={onVerTodas}
              aria-label={`Ver todas as ${ordenados.length} contas: ${titulo}`}
              style={{ display: 'block', width: '100%', padding: '12px 18px', background: 'transparent', border: 'none', borderBottom: `1px solid ${tokens.color.border}`, color: 'var(--color-ferrari)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
            >
              Ver mais · +{restantes} conta{restantes !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ContasWidget({ aReceber, aPagar, onMarcarPago, podeEditar, onVerTodas }: {
  aReceber: Transacao[];
  aPagar: Transacao[];
  onMarcarPago: (id: string) => void;
  podeEditar: boolean;
  onVerTodas: (tipo: TipoContas) => void;
}) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Lista titulo="Contas a Receber" itens={aReceber} corValor={tokens.color.ok} onMarcarPago={onMarcarPago} podeEditar={podeEditar} onVerTodas={() => onVerTodas('receber')} />
        <div style={{ width: 1, background: tokens.color.border }} />
        <Lista titulo="Contas a Pagar" itens={aPagar} corValor={tokens.color.crit} onMarcarPago={onMarcarPago} podeEditar={podeEditar} onVerTodas={() => onVerTodas('pagar')} />
      </div>
    </Card>
  );
}

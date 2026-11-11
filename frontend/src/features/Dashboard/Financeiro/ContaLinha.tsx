import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { formatBRL } from '../../../utils/dashboard';
import { Valor } from '../../../components/Privacidade';
import { labelCategoria } from './categoriaLabels';
import { dataLimiteConta, formatDataCurta } from './contasUtils';
import type { Transacao } from './types';

/** Uma conta a pagar/receber: descrição, vencimento, valor e as ações. */
export function ContaLinha({ t, corValor, podeEditar, onMarcarPago, onEditar }: {
  t: Transacao;
  corValor: string;
  podeEditar: boolean;
  onMarcarPago?: (id: string) => void;
  /** Só a tela completa passa isto; no widget a linha fica enxuta. */
  onEditar?: (t: Transacao) => void;
}) {
  const nome = t.descricao || labelCategoria(t.tipo, t.categoria);
  return (
    <div style={{ padding: '11px 18px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nome}
        </div>
        <div style={{ fontSize: '0.75rem', color: t.vencido ? tokens.color.crit : tokens.color.muted, fontWeight: t.vencido ? 700 : 400 }}>
          {t.vencido ? 'Venceu em ' : 'Vence em '}{formatDataCurta(dataLimiteConta(t))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: corValor }}><Valor texto={formatBRL(t.valor)} /></span>
        {podeEditar && onEditar && (
          <button
            type="button"
            onClick={() => onEditar(t)}
            title="Editar lançamento"
            aria-label="Editar lançamento"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32, background: 'transparent', border: 'none', cursor: 'pointer', color: tokens.color.muted }}
          >
            {Icons.edit}
          </button>
        )}
        {podeEditar && onMarcarPago && (
          <button
            type="button"
            onClick={() => onMarcarPago(t.id)}
            title="Marcar como pago"
            style={{ padding: '4px 9px', fontSize: '0.75rem', fontWeight: 700, borderRadius: 6, border: `1px solid ${tokens.color.ok}`, color: tokens.color.ok, background: 'transparent', cursor: 'pointer' }}
          >
            Pago
          </button>
        )}
      </div>
    </div>
  );
}

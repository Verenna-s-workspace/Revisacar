import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { itensCriticos } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';

interface EstoqueBaixoTiraProps {
  itens: EstoqueItem[];
  onVerTodos: () => void;
}

export function EstoqueBaixoTira({ itens, onVerTodos }: EstoqueBaixoTiraProps) {
  const criticos = itensCriticos(itens);
  if (criticos.length === 0) return null;

  const visiveis = criticos.slice(0, 4);

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, flexWrap: 'wrap' }}>
      {visiveis.map(item => (
        <div
          key={item.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: tokens.color.warnBg, border: `1px solid ${tokens.color.warnBorder}`, borderRadius: 10,
            flex: '1 1 200px', minWidth: 0,
          }}
        >
          <span style={{ color: tokens.color.warn, display: 'flex', flexShrink: 0 }}>{Icons.alert}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.nome}
            </div>
            <div style={{ fontSize: '0.7rem', color: tokens.color.warn, fontWeight: 600 }}>
              {item.quantidade} de {item.minimo} un.
            </div>
          </div>
        </div>
      ))}

      {criticos.length > 4 && (
        <button
          onClick={onVerTodos}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 10,
            border: `1px solid ${tokens.color.border}`, background: 'transparent', color: tokens.color.ferrari,
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Ver todos ({criticos.length})
        </button>
      )}
    </div>
  );
}

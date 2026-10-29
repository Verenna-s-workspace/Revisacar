import { tokens } from '../../constants';
import { useResponsive } from '../../components/ui';
import { formatBRL } from '../../utils/dashboard';
import type { OrcamentoItem } from '../../types/orcamento';

const th: React.CSSProperties = {
  textAlign: 'left', fontFamily: tokens.fontSans, fontSize: '0.75rem',
  color: tokens.color.muted, padding: '8px 10px', fontWeight: 700,
  borderBottom: `1px solid ${tokens.color.border}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px', fontSize: '0.84rem', color: tokens.color.text, verticalAlign: 'top',
  borderBottom: `1px solid ${tokens.color.border}`,
};
const num: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };

/** Itens de uma versão que não está em edição (enviada, aprovada, recusada, substituída). */
export function ItensLeitura({ itens }: { itens: OrcamentoItem[] }) {
  const { isMobile } = useResponsive();
  if (itens.length === 0) {
    return <div style={{ padding: '24px 16px', textAlign: 'center', color: tokens.color.muted, fontSize: '0.86rem' }}>Esta versão não tem itens.</div>;
  }
  const comCusto = itens.some(i => i.custoUnitario != null);

  // Celular: um cartão por item (a tabela de 520px forçava rolagem lateral)
  if (isMobile) {
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {itens.map(i => (
          <li key={i.id} style={{ padding: '14px 16px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, fontWeight: 600, fontSize: '0.9rem', color: tokens.color.text, overflowWrap: 'anywhere' }}>
                {i.descricao}
                <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 600, color: tokens.color.subtle }}>
                  {i.tipo === 'peca' ? 'peça' : 'serviço'}
                </span>
              </div>
              <div style={{ flexShrink: 0, fontWeight: 800, fontSize: '0.95rem', color: tokens.color.text }}>{formatBRL(i.subtotal)}</div>
            </div>
            <div style={{ fontSize: '0.8125rem', color: tokens.color.muted }}>
              {i.quantidade.toLocaleString('pt-BR')} × {formatBRL(i.precoUnitario)}
              {comCusto && i.custoUnitario != null ? ` · custo un. ${formatBRL(i.custoUnitario)}` : ''}
            </div>
            {i.marca && <div style={{ fontSize: '0.8125rem', color: tokens.color.muted }}>Marca: {i.marca}</div>}
            {i.motivo && <div style={{ fontSize: '0.8125rem', color: tokens.color.muted }}>{i.motivo}</div>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
        <thead>
          <tr>
            <th style={th}>Item</th>
            <th style={{ ...th, textAlign: 'right' }}>Qtd.</th>
            <th style={{ ...th, textAlign: 'right' }}>Preço un.</th>
            {comCusto && <th style={{ ...th, textAlign: 'right' }}>Custo un.</th>}
            <th style={{ ...th, textAlign: 'right' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {itens.map(i => (
            <tr key={i.id}>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>
                  {i.descricao}
                  <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 600, color: tokens.color.subtle }}>
                    {i.tipo === 'peca' ? 'peça' : 'serviço'}
                  </span>
                </div>
                {i.marca && <div style={{ fontSize: '0.76rem', color: tokens.color.muted }}>Marca: {i.marca}</div>}
                {i.motivo && <div style={{ fontSize: '0.76rem', color: tokens.color.muted }}>{i.motivo}</div>}
              </td>
              <td style={num}>{i.quantidade.toLocaleString('pt-BR')}</td>
              <td style={num}>{formatBRL(i.precoUnitario)}</td>
              {comCusto && <td style={num}>{i.custoUnitario != null ? formatBRL(i.custoUnitario) : '—'}</td>}
              <td style={{ ...num, fontWeight: 800 }}>{formatBRL(i.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

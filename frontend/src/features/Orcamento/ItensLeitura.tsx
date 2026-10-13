import { tokens } from '../../constants';
import { formatBRL } from '../../utils/dashboard';
import type { OrcamentoItem } from '../../types/orcamento';

const th: React.CSSProperties = {
  textAlign: 'left', fontFamily: tokens.fontMono, fontSize: '0.58rem', letterSpacing: '0.07em',
  textTransform: 'uppercase', color: tokens.color.subtle, padding: '8px 10px', fontWeight: 500,
  borderBottom: `1px solid ${tokens.color.border}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '10px', fontSize: '0.84rem', color: tokens.color.text, verticalAlign: 'top',
  borderBottom: `1px solid ${tokens.color.border}`,
};
const num: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };

/** Itens de uma versão que não está em edição (enviada, aprovada, recusada, substituída). */
export function ItensLeitura({ itens }: { itens: OrcamentoItem[] }) {
  if (itens.length === 0) {
    return <div style={{ padding: '24px 16px', textAlign: 'center', color: tokens.color.muted, fontSize: '0.86rem' }}>Esta versão não tem itens.</div>;
  }
  const comCusto = itens.some(i => i.custoUnitario != null);
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
                  <span style={{ marginLeft: 8, fontFamily: tokens.fontMono, fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.subtle }}>
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

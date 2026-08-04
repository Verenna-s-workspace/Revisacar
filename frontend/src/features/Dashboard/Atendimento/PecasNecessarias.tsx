import { tokens } from '../../../constants';
import { itensDoKit, kitsVinculadosNaOrdem } from '../../../utils/atendimento_utils';
import type { OSAtendimento } from '../../../types/atendimento';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';
import type { ServicoItem } from '../../../types/servico';

interface PecasNecessariasProps {
  ordem: OSAtendimento;
  kits: EstoqueKit[];
  itens: EstoqueItem[];
  servicos: ServicoItem[];
}

export function PecasNecessarias({ ordem, kits, itens, servicos }: PecasNecessariasProps) {
  const kitsMatch = kitsVinculadosNaOrdem(ordem, kits, servicos);

  // Não é obrigatório ter kit vinculado — se não achar nada, não mostra nada (Seção 6).
  if (kitsMatch.length === 0) return null;

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
        Peças Necessárias
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {kitsMatch.map(kit => (
          <div
            key={kit.id}
            style={{ padding: '11px 13px', borderRadius: 12, background: tokens.color.surfaceHigh, border: `1px solid ${tokens.color.border}` }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: tokens.color.text, marginBottom: 7 }}>{kit.nome}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {itensDoKit(kit, itens).map(({ item, quantidade, itemId }) => (
                <div key={itemId} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, fontSize: '0.78rem' }}>
                  <span style={{ color: tokens.color.textSecond, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item?.nome ?? 'Item removido do estoque'}
                    {item?.localizacao && <span style={{ color: tokens.color.muted }}> · {item.localizacao}</span>}
                  </span>
                  <span style={{ fontWeight: 700, color: tokens.color.text, flexShrink: 0 }}>{quantidade}×</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

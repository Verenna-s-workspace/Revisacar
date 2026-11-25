import { Valor } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { itemEstaBaixo } from '../../../utils/estoque_utils';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';
import { EstoqueFoto } from './EstoqueFoto';
import { formatarQuantidade } from './estoqueFormat';
import { IcAlerta, IcCaixa } from './icones';

/**
 * Cartões da lista do celular. Mostram o essencial (foto, nome, categoria, quantidade e preço);
 * o resto fica no modal de detalhes, aberto ao tocar — mesma estratégia do mobile de Ordens.
 */

export function ProdutoCartao({ item, onAbrir }: { item: EstoqueItem; onAbrir: (item: EstoqueItem) => void }) {
  const baixo = itemEstaBaixo(item);
  const emQuarentena = item.status === 'quarentena';

  return (
    <li className="esm-item">
      {/* Estoque baixo reaproveita a paleta do status "recusada" da OS (variáveis --st-*), como no desktop */}
      <button
        type="button"
        className={`esm-cartao${baixo ? ' esm-cartao--baixo os-status--recusada' : ''}`}
        aria-label={`Abrir ${item.nome}`}
        onClick={() => onAbrir(item)}
      >
        <EstoqueFoto src={item.fotoDataUrl} />
        <span className="esm-info">
          <span className="esm-nome">{item.nome}</span>
          <span className="esm-detalhe">{[item.categoria, item.localizacao].filter(Boolean).join(' · ')}</span>
          {emQuarentena && (
            <span className="es-selo os-status--pendente_aprovacao esm-selo">
              <span className="es-selo__ponto" aria-hidden="true" />
              Quarentena
            </span>
          )}
        </span>
        <span className="esm-numeros">
          <span className="esm-qtd">
            {baixo ? IcAlerta : IcCaixa}
            {baixo && <span className="es-sr">Estoque baixo: </span>}
            {formatarQuantidade(item.quantidade)}
          </span>
          <span className="esm-preco"><Valor texto={formatBRL(item.preco)} /></span>
        </span>
      </button>
    </li>
  );
}

export function KitCartao({ kit, disponibilidade, onAbrir }: { kit: EstoqueKit; disponibilidade: number; onAbrir: (kit: EstoqueKit) => void }) {
  const indisponivel = disponibilidade <= 0;
  const n = kit.itens.length;

  return (
    <li className="esm-item">
      <button type="button" className="esm-cartao" aria-label={`Abrir kit ${kit.nome}`} onClick={() => onAbrir(kit)}>
        <EstoqueFoto src={kit.fotoDataUrl} />
        <span className="esm-info">
          <span className="esm-nome">{kit.nome}</span>
          <span className="esm-detalhe">{n} {n === 1 ? 'componente' : 'componentes'}</span>
        </span>
        <span className="esm-numeros">
          {indisponivel ? (
            <span className="es-selo os-status--recusada">
              <span className="es-selo__ponto" aria-hidden="true" />
              Indisponível
            </span>
          ) : (
            <span className="es-selo os-status--finalizada">
              <span className="es-selo__ponto" aria-hidden="true" />
              Dá pra montar {disponibilidade}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

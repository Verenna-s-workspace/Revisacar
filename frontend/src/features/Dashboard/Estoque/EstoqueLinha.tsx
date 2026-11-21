import type { MouseEvent as ReactMouseEvent } from 'react';
import { Valor, MASCARA_NUMERO } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { itemEstaBaixo } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';
import { EstoqueFoto } from './EstoqueFoto';
import { IcAlerta, IcCaixa, IcDinheiro, IcReticencias } from './icones';

/** Quantidade pode ser fracionada (ex.: 1,5 L) — no padrão pt-BR, sem zeros sobrando. */
export function formatarQuantidade(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/** Valor sem o "R$": o ícone de dinheiro já faz o papel do símbolo (leitor de tela lê "R$"). */
function Preco({ valor }: { valor?: number }) {
  if (valor === undefined || valor === null) return <span className="es-vazio">—</span>;
  return (
    <span className="es-preco">
      {IcDinheiro}
      <span className="es-sr">R$ </span>
      <Valor texto={formatBRL(valor).replace(/^R\$\s*/, '')} mascara={MASCARA_NUMERO} />
    </span>
  );
}

interface EstoqueLinhaProps {
  item: EstoqueItem;
  /** Custo é dado sensível (financeiro.ver_margem) — a coluna só existe pra quem pode ver. */
  mostrarCusto: boolean;
  menuAberto: boolean;
  onAbrir: (item: EstoqueItem) => void;
  onMenu: (e: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
}

export function EstoqueLinha({ item, mostrarCusto, menuAberto, onAbrir, onMenu }: EstoqueLinhaProps) {
  const baixo = itemEstaBaixo(item);
  const emQuarentena = item.status === 'quarentena';
  const reservado = item.reservado ?? 0;

  // Estoque baixo reaproveita a paleta do status "recusada" da Ordem de Serviço
  // (os-status--recusada, em Ordens/Status.css): a linha lê as variáveis --st-*.
  const classe = [
    'es-linha',
    baixo ? 'es-linha--baixo os-status--recusada' : '',
    menuAberto ? 'es-linha--menu' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      role="row"
      className={classe}
      tabIndex={0}
      aria-label={`Abrir ${item.nome}`}
      onClick={() => onAbrir(item)}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(item); }
      }}
    >
      <div role="cell" className="es-cel es-cel-item">
        <EstoqueFoto src={item.fotoDataUrl} />
        <div className="es-item">
          <div className="es-item__linha">
            <span className="es-item__nome" title={item.nome}>{item.nome}</span>
            {emQuarentena && (
              <span className="es-selo os-status--pendente_aprovacao">
                <span className="es-selo__ponto" aria-hidden="true" />
                Quarentena
              </span>
            )}
          </div>
          {item.localizacao && <div className="es-item__local" title={item.localizacao}>{item.localizacao}</div>}
        </div>
      </div>

      <div role="cell" className="es-cel es-cel-categoria">{item.categoria}</div>

      <div role="cell" className="es-cel es-cel-qtd">
        <span className="es-qtd">
          {baixo ? IcAlerta : IcCaixa}
          {baixo && <span className="es-sr">Estoque baixo: </span>}
          <span className="es-qtd__valor">{formatarQuantidade(item.quantidade)}</span>
        </span>
        {reservado > 0 && (
          <span className="es-qtd__reservado">
            {formatarQuantidade(reservado)} reservado{reservado === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {mostrarCusto && <div role="cell" className="es-cel es-cel-num"><Preco valor={item.custo} /></div>}
      <div role="cell" className="es-cel es-cel-num"><Preco valor={item.preco} /></div>

      <div role="cell" className="es-cel es-cel-acoes">
        <button
          type="button"
          className="es-mais"
          data-es-menu-gatilho
          aria-label={`Mais ações de ${item.nome}`}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          onClick={e => onMenu(e, item.id)}
          onKeyDown={e => e.stopPropagation()}
        >
          {IcReticencias}
        </button>
      </div>
    </div>
  );
}

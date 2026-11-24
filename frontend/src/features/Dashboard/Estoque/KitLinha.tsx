import type { MouseEvent as ReactMouseEvent } from 'react';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';
import { EstoqueFoto } from './EstoqueFoto';
import { IcReticencias } from './icones';

interface KitLinhaProps {
  kit: EstoqueKit;
  itensPorId: Map<string, EstoqueItem>;
  disponibilidade: number;
  aplicando: boolean;
  /** Erro do último "Aplicar kit" (ex.: peça sem saldo) — nunca aplica parcial. */
  erro: string | null;
  menuAberto: boolean;
  onAbrir: (kit: EstoqueKit) => void;
  onAplicar: (kit: EstoqueKit) => void;
  onMenu: (e: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
}

export function KitLinha({ kit, itensPorId, disponibilidade, aplicando, erro, menuAberto, onAbrir, onAplicar, onMenu }: KitLinhaProps) {
  const indisponivel = disponibilidade <= 0;

  const receita = kit.itens
    .map(r => `${r.quantidade}x ${itensPorId.get(r.itemId)?.nome ?? 'item removido'}`)
    .join(' · ');

  return (
    <div
      role="row"
      className={`es-linha${menuAberto ? ' es-linha--menu' : ''}`}
      tabIndex={0}
      aria-label={`Abrir kit ${kit.nome}`}
      onClick={() => onAbrir(kit)}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(kit); }
      }}
    >
      <div role="cell" className="es-cel es-cel-item">
        <EstoqueFoto src={kit.fotoDataUrl} />
        <div className="es-item">
          <div className="es-item__linha">
            <span className="es-item__nome" title={kit.nome}>{kit.nome}</span>
          </div>
          {erro
            ? <div className="es-item__erro" role="alert" title={erro}>{erro}</div>
            : kit.descricao && <div className="es-item__local" title={kit.descricao}>{kit.descricao}</div>}
        </div>
      </div>

      <div role="cell" className="es-cel es-cel-receita" title={receita}>{receita || <span className="es-vazio">—</span>}</div>

      <div role="cell" className="es-cel">
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
      </div>

      <div role="cell" className="es-cel es-cel-acoes es-cel-acoes--kit">
        <button
          type="button"
          className="es-btn es-btn--secundario es-btn--sm"
          disabled={indisponivel || aplicando}
          onClick={e => { e.stopPropagation(); onAplicar(kit); }}
          onKeyDown={e => e.stopPropagation()}
        >
          {aplicando ? 'Aplicando...' : 'Aplicar kit'}
        </button>
        <button
          type="button"
          className="es-mais"
          data-es-menu-gatilho
          aria-label={`Mais ações do kit ${kit.nome}`}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          onClick={e => onMenu(e, kit.id)}
          onKeyDown={e => e.stopPropagation()}
        >
          {IcReticencias}
        </button>
      </div>
    </div>
  );
}

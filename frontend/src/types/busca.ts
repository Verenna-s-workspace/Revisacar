// Busca global (⌘K / Ctrl+K): formato de GET /busca?q= (backend/orders/busca_views.py).

export type TipoResultadoBusca = 'cliente' | 'veiculo' | 'ordem';

/** Um resultado é só um RESUMO: a tela de destino abre o registro completo pelo `id`. */
export interface ResultadoBusca {
  tipo: TipoResultadoBusca;
  id: string;
  titulo: string;
  subtitulo: string;
  /** Só nas ordens de serviço. */
  status?: string;
}

export interface GrupoBusca {
  itens: ResultadoBusca[];
  /** Quantas correspondências existem no total (os `itens` vêm limitados). */
  total: number;
}

/** Um grupo só vem se o cargo pode ver aquele módulo. `indisponiveis` lista grupos que falharam no banco. */
export interface RespostaBusca {
  clientes?: GrupoBusca;
  veiculos?: GrupoBusca;
  ordens?: GrupoBusca;
  indisponiveis?: Array<'clientes' | 'veiculos' | 'ordens'>;
}

/** Pedido, guardado no Dashboard, para a tela de destino abrir um registro assim que a lista dela carregar. */
export interface AbrirRegistro {
  tipo: TipoResultadoBusca;
  id: string;
  /** Muda a cada pedido: abrir o mesmo registro duas vezes seguidas precisa funcionar. */
  nonce: number;
}

// ── Estoque: tipos ────────────────────────────────────────────────────────────

export type StatusEstoqueItem = 'ativo' | 'quarentena';

export interface EstoqueItemQuarentena {
  motivo: string;
  fornecedor: string;
  /** ISO — usada pra calcular "há quantos dias parado". */
  dataEntrada: string;
}

export interface EstoqueItem {
  id: string;
  nome: string;
  categoria: string;          // ver CATEGORIA_GRUPOS em utils/estoque_utils.ts
  quantidade: number;
  minimo: number;
  preco: number;
  localizacao: string;        // texto livre
  descricao?: string;
  /** Texto livre pesquisável, ex.: "Gol 1.6 2016-2019, Voyage 1.6 2015-2018". */
  aplicacao?: string;
  /** Foto real enviada pelo usuário — sem backend de storage, some no F5. */
  fotoDataUrl?: string;
  status: StatusEstoqueItem;
  /** Presente só quando status === 'quarentena'. */
  quarentena?: EstoqueItemQuarentena;
  createdAt: string;
  updatedAt?: string;
}

/** Payload utilizado para criar/editar um item a partir do modal de produto. */
export interface NovoEstoqueItemInput {
  nome: string;
  categoria: string;
  quantidade: number;
  minimo: number;
  preco: number;
  localizacao: string;
  descricao?: string;
  aplicacao?: string;
  fotoDataUrl?: string;
  status: StatusEstoqueItem;
  quarentena?: EstoqueItemQuarentena;
}

export interface EstoqueKitItemReceita {
  itemId: string;
  quantidade: number;
}

export interface EstoqueKit {
  id: string;
  nome: string;                        // ex.: "Kit Revisão Básica Fiat Uno"
  descricao?: string;
  itens: EstoqueKitItemReceita[];      // receita — kit não tem quantidade própria
  /** Vínculo opcional com um ServicoItem do Catálogo. Fonte da verdade é o Kit. */
  servicoId?: string;
  fotoDataUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Payload utilizado para criar/editar um kit a partir do modal de kit. */
export interface NovoEstoqueKitInput {
  nome: string;
  descricao?: string;
  itens: EstoqueKitItemReceita[];
  servicoId?: string;
  fotoDataUrl?: string;
}

export type TipoMovimentoEstoque = 'entrada' | 'saida' | 'ajuste';

export interface MovimentoEstoque {
  id: string;
  itemId: string;
  tipo: TipoMovimentoEstoque;
  quantidade: number;          // sempre positivo — o sinal é dado por `tipo`
  motivo: string;               // ex.: "Kit: <nome>", "Cadastro inicial", "Ajuste manual: 12 → 8"
  /** Reservado pro futuro (peça sob encomenda vinculada a uma OS) — nada popula ainda. */
  ordemId?: string;
  criadoEm: string;
}

/** Filtro de baixo estoque já usado na tela — 'todos' | 'baixo'. */
export type FiltroEstoqueTipo = 'todos' | 'baixo';

/** Resultado da aplicação de um kit — nunca aplica parcial. */
export type ResultadoAplicarKit =
  | { ok: true }
  | { ok: false; mensagem: string };

/** Um item agregado no gráfico "Itens de Estoque Mais Movimentados" (Relatórios). */
export interface ItemEstoqueMovimentado {
  nome: string;
  categoria: string; // '' pro bucket agregado "Outros" — cai no ícone genérico
  quantidade: number;
  percentual: number;
}

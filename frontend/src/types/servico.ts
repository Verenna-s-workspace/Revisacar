// ── Catálogo de Serviços: tipos ───────────────────────────────────────────────

/** Item cadastrado no catálogo de serviços da oficina. */
export interface ServicoItem {
  id: string;
  nome: string;
  categoria: string;   // texto livre — sem taxonomia fixa
  preco: number;
  duracao: string;     // texto livre (ex.: "45 min", "1h 30min")
  descricao: string;
  ativo: boolean;
  createdAt: string;
  updatedAt?: string;
}

/** Payload utilizado para criar/editar um serviço a partir do modal de cadastro. */
export interface NovoServicoInput {
  nome: string;
  categoria: string;
  preco: number;
  duracao: string;
  descricao: string;
  ativo?: boolean;
}

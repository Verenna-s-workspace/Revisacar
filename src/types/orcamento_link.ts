// ── Link público do orçamento (Fase 6): tipos ────────────────────────────────
// Espelha backend/orders/orcamento_link_views.py (JSON camelCase).

/** O link como a OFICINA vê (GET/POST /orcamentos/<id>/link). */
export interface LinkOrcamento {
  id: string;
  /** Vai na URL: `${origem}/o/${token}`. */
  token: string;
  criadoEm: string;
  expiraEm: string;
  /** Não revogado e dentro do prazo. */
  ativo: boolean;
  acessos: number;
  primeiroAcessoEm?: string;
  ultimoAcessoEm?: string;
  /** Preenchidos quando o cliente respondeu pelo link. */
  decididoEm?: string;
  decisao?: 'aprovado' | 'recusado';
  decisaoNome?: string;
}

export type BloqueioPublico = 'aprovado' | 'recusado' | 'substituido' | 'vencido' | null;

/** O que o CLIENTE vê (GET /publico/orcamentos/<token>) — nunca traz custo, margem nem dados internos. */
export interface OrcamentoPublico {
  oficina: { nome: string };
  ordem: {
    osNum: string;
    clienteNome: string;
    veiculo: { placa: string; modelo: string; ano: string; cor: string };
  };
  orcamento: {
    versao: number;
    status: 'enviado' | 'aprovado' | 'recusado' | 'substituido';
    total: number;
    validadeAte?: string | null;
    vencido: boolean;
    observacoes: string;
    itens: { tipo: 'peca' | 'servico'; descricao: string; marca: string; quantidade: number; precoUnitario: number; subtotal: number; motivo: string }[];
    enviadoEm?: string;
    aprovadoEm?: string;
    aprovadoPorNome?: string;
    recusadoEm?: string;
  };
  pdfDisponivel: boolean;
  /** Dá pra aprovar/recusar agora (enviado, dentro da validade). */
  podeDecidir: boolean;
  bloqueio: BloqueioPublico;
}

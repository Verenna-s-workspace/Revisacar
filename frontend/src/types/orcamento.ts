// ── Orçamento da OS (etapa 3): tipos ──────────────────────────────────────────
// Espelha backend/orders/orcamento_views.py (JSON camelCase).

export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'substituido';
export type TipoItemOrcamento = 'peca' | 'servico';
export type CanalAprovacao = 'whatsapp' | 'presencial' | 'telefone' | 'app' | 'outro';

export interface OrcamentoItem {
  id: string;
  tipo: TipoItemOrcamento;
  descricao: string;
  marca: string;
  quantidade: number;
  /** O que o cliente paga — o único valor que aparece no PDF. */
  precoUnitario: number;
  subtotal: number;
  motivo: string;
  estoqueItemId?: string;
  servicoId?: string;
  /** Só vem pra quem tem financeiro.ver_margem. */
  custoUnitario?: number;
}

/** O que enviar/aprovar/recusar fez no Financeiro e no Estoque (resposta do servidor). */
export interface EfeitosOrcamento {
  financeiro: { categoria: 'pecas' | 'servicos'; acao: 'criado' | 'atualizado' | 'cancelado'; valor: number }[];
  /** Quantos itens de estoque ficaram reservados pra OS. */
  reservas: number;
  /** Quantos itens tiveram a reserva liberada. */
  liberadas: number;
  /** Reservado além do que há em estoque (não bloqueia — é preciso comprar). */
  faltas: { itemId: string; nome: string; reservado: number; disponivel: number }[];
  avisos: { codigo: 'lancamento_pago'; categoria: 'pecas' | 'servicos' }[];
}

export interface Orcamento {
  id: string;
  ordemId: string;
  versao: number;
  status: StatusOrcamento;
  validadeDias: number;
  /** YYYY-MM-DD — definida no envio. */
  validadeAte?: string;
  /** Enviado e já passou da validade: não dá mais pra aprovar. */
  vencido?: boolean;
  observacoes: string;
  total: number;
  itens: OrcamentoItem[];
  criadoPorNome: string;
  createdAt: string;
  updatedAt?: string;
  enviadoEm?: string;
  aprovadoEm?: string;
  aprovadoPorNome?: string;
  aprovacaoCanal?: CanalAprovacao;
  aprovacaoObs?: string;
  recusadoEm?: string;
  motivoRecusa?: string;
  /** Só vêm pra quem tem financeiro.ver_margem. */
  custoTotal?: number;
  margem?: number;
  margemPercentual?: number;
  /** Status da OS depois da operação (resposta de criar/enviar/aprovar/recusar). */
  osStatus?: string;
  /** Já existe PDF guardado dessa versão. */
  efeitos?: EfeitosOrcamento;
  pdfDisponivel?: boolean;
  /** Foi aprovado com assinatura desenhada. */
  assinado?: boolean;
  /** Só nas respostas de enviar/aprovar: false = o PDF/assinatura não foi guardado agora (o download refaz). */
  pdfGerado?: boolean;
  assinaturaSalva?: boolean;
}

/** Item em edição na tela: números como texto (o usuário digita "1,5"), `chave` só pro React. */
export interface ItemRascunho {
  chave: string;
  /** id do item já gravado — o servidor usa pra preservar o custo de quem não o enxerga. */
  id?: string;
  tipo: TipoItemOrcamento;
  descricao: string;
  marca: string;
  quantidade: string;
  precoUnitario: string;
  /** '' = não informado. Ignorado (nem é enviado) pra quem não tem ver_margem. */
  custoUnitario: string;
  motivo: string;
  estoqueItemId?: string;
  servicoId?: string;
  /** Veio das etapas 1/2 (só pra mostrar o selo "do diagnóstico"). */
  doDiagnostico?: boolean;
}

export interface OrcamentoSalvarInput {
  validadeDias?: number;
  observacoes?: string;
  itens?: Record<string, unknown>[];
}

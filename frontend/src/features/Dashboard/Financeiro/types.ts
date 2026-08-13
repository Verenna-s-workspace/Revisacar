export interface Transacao {
  id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  forma_pagamento: string | null;
  status: 'pendente' | 'pago' | 'cancelado';
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  cliente_nome: string;
  ordem_servico_id: string | null;
  criado_por_nome?: string;
  criado_por_tipo?: string;
  /** Calculado pelo backend na leitura — nunca é gravado como status. */
  vencido: boolean;
}

export interface Categorias {
  entrada: string[];
  saida: string[];
  formas_pagamento: string[];
}

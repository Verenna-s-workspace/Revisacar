/** Selo do status no cartão: rótulo + tom de cor (definido em atendimento.css). */
export const STATUS_CARTAO: Record<string, { rotulo: string; tom: string }> = {
  rascunho:           { rotulo: 'Entrada',              tom: 'entrada' },
  em_orcamento:       { rotulo: 'Em orçamento',         tom: 'orcamento' },
  pendente_aprovacao: { rotulo: 'Aguardando aprovação', tom: 'aprovacao' },
  aprovada:           { rotulo: 'Aprovada',             tom: 'aprovada' },
  em_execucao:        { rotulo: 'Em execução',          tom: 'execucao' },
  aguardando:         { rotulo: 'Aguardando peça',      tom: 'pecas' },
  finalizada:         { rotulo: 'Concluída',            tom: 'concluida' },
};

export function statusDoCartao(status: string) {
  return STATUS_CARTAO[status] ?? STATUS_CARTAO.rascunho;
}

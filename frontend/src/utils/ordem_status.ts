// Status da OS — espelho de backend/orders/ordem_status.py (manter em sincronia).
//
// "finalizada" = serviço CONCLUÍDO. Salvar o checklist completo NÃO conclui a OS:
// só leva de rascunho para em_orcamento. As outras mudanças passam pelo
// PATCH /ordens/<id>/status (api.definirStatusOrdem), que confere as transições.

export type StatusOrdem =
  | 'rascunho'
  | 'em_orcamento'
  | 'pendente_aprovacao'
  | 'aprovada'
  | 'em_execucao'
  | 'aguardando'
  | 'finalizada'
  | 'recusada';

/** Ainda no preenchimento do checklist/orçamento, antes de o serviço começar. */
const ANTES_DA_EXECUCAO: readonly string[] = ['rascunho', 'em_orcamento', 'pendente_aprovacao', 'aprovada'];

/** Serviço concluído (é o que Relatórios e Visão Geral contam). */
export const statusConcluida = (s: string | null | undefined) => s === 'finalizada';

/** Parada esperando peça/aprovação — vai para a coluna "Bloqueado" do Atendimento. */
export const statusBloqueada = (s: string | null | undefined) => s === 'aguardando';

/** Antes de a execução começar (a "Fila" do Atendimento, a menos que já tenha sido iniciada). */
export const statusAntesDaExecucao = (s: string | null | undefined) => !!s && ANTES_DA_EXECUCAO.includes(s);

/** Trabalhando no veículo agora. */
export const statusEmExecucao = (s: string | null | undefined) => s === 'em_execucao';

/** Encerrada sem execução: não é trabalho pendente em nenhuma coluna. */
export const statusRecusada = (s: string | null | undefined) => s === 'recusada';

export const ROTULO_STATUS: Record<StatusOrdem, string> = {
  rascunho: 'Em andamento',
  em_orcamento: 'Em orçamento',
  pendente_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  aguardando: 'Aguardando peças',
  finalizada: 'Concluída',
  recusada: 'Recusada',
};

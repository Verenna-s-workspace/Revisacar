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

// ── Aparência dos selos (usada por components/system/Badge e icons) ───────────

/** Uma das 8 fases da OS (uma por status). */
export type FaseOS = StatusOrdem;

/** Chave do ícone de cada fase — o desenho fica em components/system/icons.tsx. */
export type IconeFase =
  | 'inbox'
  | 'documento'
  | 'relogio'
  | 'caixa'
  | 'chave'
  | 'checkCirculo'
  | 'checkDuplo'
  | 'xCirculo'
  | 'check';

export interface InfoStatusOS {
  fase: FaseOS;
  icone: IconeFase;
  rotulo: string;
}

/** Ícone de cada fase. A cor vem de ESTILO_FASE. */
const ICONE_FASE: Record<FaseOS, IconeFase> = {
  rascunho: 'inbox',
  em_orcamento: 'documento',
  pendente_aprovacao: 'relogio',
  aprovada: 'checkCirculo',
  em_execucao: 'chave',
  aguardando: 'caixa',
  finalizada: 'checkDuplo',
  recusada: 'xCirculo',
};

/** Cor do texto e do fundo de cada fase (tokens de index.css, que já trocam no modo escuro). */
const ESTILO_FASE: Record<FaseOS, { color: string; bg: string }> = {
  rascunho:           { color: 'var(--color-muted)', bg: 'var(--color-surface-high)' },
  em_orcamento:       { color: 'var(--color-warn)',  bg: 'var(--color-warn-bg)' },
  pendente_aprovacao: { color: 'var(--color-warn)',  bg: 'var(--color-warn-bg)' },
  aprovada:           { color: 'var(--color-ok)',    bg: 'var(--color-ok-bg)' },
  em_execucao:        { color: 'var(--color-ok)',    bg: 'var(--color-ok-bg)' },
  aguardando:         { color: 'var(--color-crit)',  bg: 'var(--color-crit-bg)' },
  finalizada:         { color: 'var(--color-ok)',    bg: 'var(--color-ok-bg)' },
  recusada:           { color: 'var(--color-na)',    bg: 'var(--color-na-bg)' },
};

export const estiloFase = (fase: FaseOS) => ESTILO_FASE[fase];

const ehStatusConhecido = (s: string | null | undefined): s is StatusOrdem =>
  !!s && Object.prototype.hasOwnProperty.call(ROTULO_STATUS, s);

/**
 * Fase, ícone e rótulo de um status. Valor desconhecido ou vazio (linha antiga)
 * cai em "rascunho", igual ao backend (status_no_salvamento).
 */
export function infoStatusOS(status: string | null | undefined): InfoStatusOS {
  const fase: FaseOS = ehStatusConhecido(status) ? status : 'rascunho';
  return { fase, icone: ICONE_FASE[fase], rotulo: ROTULO_STATUS[fase] };
}

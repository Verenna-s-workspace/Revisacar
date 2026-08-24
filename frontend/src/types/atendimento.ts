// ── Atendimento: tipos ────────────────────────────────────────────────────────
// Painel operacional do mecânico. Não introduz nenhum status novo de OS nem
// mexe no payload real da OS — ver Seção 3/4 do prompt. Os campos abaixo que
// não existem no backend (OrdemServicoSerializer) vivem só no overlay local
// (localStorage), mesclados com a OS real na hora de exibir.

import type { OrdemRow } from './dashboard';
import type { Agendamento } from './agendamento';

export type PrioridadeAtendimento = 'vip' | 'garantia';

/**
 * Overlay local de uma OS — indexado por id da OS, gravado em localStorage
 * (ver `revisacar:atendimento-overlay` em utils/atendimento_utils.ts).
 * TODO backend (mesmo padrão de `valor_total` em Relatórios): quando o
 * OrdemServicoSerializer expuser estes campos de verdade, troca-se a fonte de
 * leitura/escrita aqui sem precisar reescrever a tela.
 */
export interface OverlayOS {
  ordemId: string;
  /** Setado automaticamente na 1ª vez que o checklist é aberto a partir daqui — nunca manual. */
  iniciadoEm?: string | null;
  reclamacaoCliente?: string;
  observacoesInternas?: string;
  clienteAvisado?: boolean;
  prioridade?: PrioridadeAtendimento | null;
  /** Só tem sentido enquanto status === 'aguardando' — limpo automaticamente ao desbloquear. */
  motivoBloqueio?: string;
}

/** `Record<ordemId, OverlayOS>` — formato salvo sob a chave única do localStorage. */
export type OverlayMap = Record<string, OverlayOS>;

/** OrdemRow (dado real) mesclada com os campos opcionais do overlay local. */
export type OSAtendimento = OrdemRow & {
  iniciadoEm?: string | null;
  reclamacaoCliente?: string;
  observacoesInternas?: string;
  clienteAvisado?: boolean;
  prioridade?: PrioridadeAtendimento | null;
  motivoBloqueio?: string;
};

export type KanbanColunaId = 'fila' | 'em_execucao' | 'bloqueado' | 'concluido';

/**
 * Item de uma coluna do Kanban. A coluna "Fila" mistura dois tipos (agendamento
 * ainda sem OS + OS rascunho não iniciada); as outras 3 colunas só têm OS, mas
 * usam o mesmo formato pra o card compacto poder ser um componente só.
 */
export type ItemKanban =
  | { tipo: 'agendamento'; agendamento: Agendamento }
  | { tipo: 'os'; ordem: OSAtendimento };

export interface ColunasKanban {
  fila: ItemKanban[];
  em_execucao: ItemKanban[];
  bloqueado: ItemKanban[];
  concluido: ItemKanban[];
}

/**
 * Dados pra pré-preencher uma OS NOVA a partir de um agendamento (Seção 8 —
 * "Iniciar Atendimento"). Extensão mínima e opcional do ponto de entrada do
 * checklist (`pages/InitialChecklist.tsx`) — não altera a lógica interna dele.
 */
export interface OSPrefillInput {
  clienteNome: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  /** Se veio de um agendamento, permite marcar `ordemServicoId` nele assim que a OS ganhar um id de verdade. */
  agendamentoId?: string;
}

export const KANBAN_COLUNAS: { id: KanbanColunaId; titulo: string }[] = [
  { id: 'fila', titulo: 'Fila' },
  { id: 'em_execucao', titulo: 'Em Execução' },
  { id: 'bloqueado', titulo: 'Bloqueado' },
  { id: 'concluido', titulo: 'Concluído' },
];

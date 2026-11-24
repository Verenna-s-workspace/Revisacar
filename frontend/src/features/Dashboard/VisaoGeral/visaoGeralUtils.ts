import { valorOS } from '../../../utils/relatorios';
import { diasDesde } from '../../../utils/atendimento_utils';
import type { OSAtendimento, ColunasKanban, ItemKanban } from '../../../types/atendimento';
import type { Agendamento } from '../../../types/agendamento';
import type { AlertaItem, FonteAlertaId, GrupoAlertas, AcaoAlerta } from '../../../utils/alertas';
import type { AlertasBackend } from '../../../types/alertas';

// ── "Na oficina": os carros que a tela de Atendimento mostra ─────────────────
// Fonte única = as colunas do Atendimento (utils/atendimento_utils.derivarColunasKanban),
// pra o número daqui nunca divergir do quadro. Ficam de fora os agendamentos ainda sem OS
// (o carro não chegou) — só entram OS.

export type FiltroPatio = 'todas' | 'em_execucao' | 'bloqueado' | 'fila' | 'prontas';

export const ROTULO_FILTRO_PATIO: Record<FiltroPatio, string> = {
  todas: 'Todas',
  em_execucao: 'Em execução',
  bloqueado: 'Aguardando peça',
  fila: 'Na fila',
  prontas: 'Prontas',
};
export const FILTROS_PATIO: readonly FiltroPatio[] = ['todas', 'em_execucao', 'bloqueado', 'fila', 'prontas'];

export interface LinhaPatio { ordem: OSAtendimento; grupo: Exclude<FiltroPatio, 'todas'> }

const soOS = (itens: ItemKanban[]): OSAtendimento[] =>
  itens.flatMap(i => (i.tipo === 'os' ? [i.ordem] : []));

/** Todas as OS "na oficina", já na ordem de exibição: em execução, aguardando peça, fila, prontas. */
export function linhasDoPatio(colunas: ColunasKanban): LinhaPatio[] {
  return [
    ...soOS(colunas.em_execucao).map(ordem => ({ ordem, grupo: 'em_execucao' as const })),
    ...soOS(colunas.bloqueado).map(ordem => ({ ordem, grupo: 'bloqueado' as const })),
    ...soOS(colunas.fila).map(ordem => ({ ordem, grupo: 'fila' as const })),
    ...soOS(colunas.concluido).map(ordem => ({ ordem, grupo: 'prontas' as const })),
  ];
}

export function contagemPatio(linhas: LinhaPatio[]): Record<FiltroPatio, number> {
  const c: Record<FiltroPatio, number> = { todas: linhas.length, em_execucao: 0, bloqueado: 0, fila: 0, prontas: 0 };
  linhas.forEach(l => { c[l.grupo] += 1; });
  return c;
}

/** Valor da OS para a tabela; null = "—" (orçamento ainda sem valor fechado). */
export function valorDaLinha(o: OSAtendimento): number | null {
  if (typeof o.valor_total === 'number') return o.valor_total;
  if (o.status === 'rascunho' || o.status === 'em_orcamento') return null;
  return valorOS(o);
}

// ── Textos ───────────────────────────────────────────────────────────────────

/** "Sábado, 21 de novembro" */
export function dataPorExtenso(d: Date = new Date()): string {
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function carrosNaOficina(n: number): string {
  if (n === 0) return 'Nenhum carro na oficina';
  return `${n} ${n === 1 ? 'carro' : 'carros'} na oficina`;
}

/** "mais antigo há 2 dias" / "mais antigo de hoje" a partir da última mudança de status. */
export function maisAntigoTexto(ordens: OSAtendimento[]): string {
  if (!ordens.length) return 'Nenhum orçamento pendente';
  const dias = Math.max(...ordens.map(o => diasDesde(o.updated_at)));
  if (dias <= 0) return 'Mais antigo é de hoje';
  return `Mais antigo há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

// ── Agenda de hoje ───────────────────────────────────────────────────────────

/** Agendamentos de hoje que contam como compromisso (fora cancelados, recusados e pedidos pendentes). */
export function agendaDeHoje(agendamentos: Agendamento[], hojeISO: string): Agendamento[] {
  return agendamentos
    .filter(a => a.data === hojeISO && !['cancelado', 'recusado', 'pendente'].includes(a.status))
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

// ── "Precisa de você": uma linha por tipo de alerta ──────────────────────────

const GRUPOS_QUE_ABREM_A_OS: FonteAlertaId[] = ['os_sem_pagamento', 'os_bloqueada', 'os_aprovada_parada'];
const GRUPOS_DE_ESTOQUE: FonteAlertaId[] = ['estoque_baixo', 'reserva_sem_estoque', 'estoque_quarentena'];

export interface LinhaAlerta {
  grupo: GrupoAlertas;
  /** Texto do botão. */
  rotulo: string;
  /** null = vai para a tela de Alertas (grupo com vários itens). */
  acao: AcaoAlerta | null;
}

export function linhaDoGrupo(grupo: GrupoAlertas): LinhaAlerta {
  const { itens, fonte } = grupo;
  if (itens.length === 1) {
    const item = itens[0];
    const acao = GRUPOS_QUE_ABREM_A_OS.includes(fonte.id) ? (item.acaoSecundaria ?? item.acao) : item.acao;
    const rotulo = GRUPOS_DE_ESTOQUE.includes(fonte.id) ? 'Ver estoque'
      : GRUPOS_QUE_ABREM_A_OS.includes(fonte.id) ? 'Ver OS'
      : acao.rotulo;
    return { grupo, rotulo, acao };
  }
  // Vários itens: a tela de Alertas lista um por um (e deixa adiar/dispensar).
  return { grupo, rotulo: 'Ver todos', acao: null };
}

/** Segunda linha: nomes dos primeiros itens (nunca valores — o dinheiro vai à parte, com a máscara de privacidade). */
export function detalheDoGrupo(itens: AlertaItem[]): string {
  const nomes = itens.slice(0, 2).map(i => i.titulo);
  const resto = itens.length - nomes.length;
  return nomes.join(', ') + (resto > 0 ? ` +${resto}` : '');
}

/** Total a receber das OS concluídas sem pagamento que ainda estão visíveis no grupo. */
export function totalAReceber(grupo: GrupoAlertas, backend: AlertasBackend | null | undefined): number | null {
  if (grupo.fonte.id !== 'os_sem_pagamento' || !backend?.semPagamento) return null;
  const ids = new Set(grupo.itens.map(i => i.id));
  const visiveis = backend.semPagamento.filter(o => ids.has(`os_sem_pagamento:${o.ordemId}`));
  return visiveis.length ? visiveis.reduce((s, o) => s + o.valorPendente, 0) : null;
}

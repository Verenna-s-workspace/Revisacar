import type { OrdemRow } from '../../../types/dashboard';
import { ROTULO_STATUS, naOficina } from '../../../utils/ordem_status';

// ── Filtros de status (chips) ─────────────────────────────────────────────────
// Um chip por status da OS, com o mesmo nome do selo da tabela (ver ROTULO_STATUS).
// Status desconhecido (linha antiga) conta como "Entrada", igual ao selo.

export type FiltroStatus =
  | 'todas' | 'rascunho' | 'em_orcamento' | 'pendente_aprovacao' | 'aprovada'
  | 'em_execucao' | 'aguardando' | 'finalizada' | 'recusada';

export const FILTROS: readonly FiltroStatus[] = [
  'todas', 'rascunho', 'em_orcamento', 'pendente_aprovacao', 'aprovada',
  'em_execucao', 'aguardando', 'finalizada', 'recusada',
];

export const ROTULO_FILTRO: Record<FiltroStatus, string> = {
  todas: 'Todas',
  rascunho: 'Entrada',
  em_orcamento: 'Em orçamento',
  pendente_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovadas',
  em_execucao: 'Em execução',
  aguardando: 'Aguardando peça',
  finalizada: 'Concluídas',
  recusada: 'Recusadas',
};

/** Status do banco -> chip em que ele conta. */
function grupoDoStatus(status: string): Exclude<FiltroStatus, 'todas'> {
  return (FILTROS as readonly string[]).includes(status) && status !== 'todas'
    ? (status as Exclude<FiltroStatus, 'todas'>)
    : 'rascunho';
}

export const noFiltro = (status: string, f: FiltroStatus) =>
  f === 'todas' || grupoDoStatus(status) === f;

// ── Rótulos e visual do status (tabela e filtros) ────────────────────────────

/** Mesmos nomes em todas as telas (fonte: utils/ordem_status.ROTULO_STATUS). */
export const ROTULO_STATUS_OS: Record<string, string> = ROTULO_STATUS;

/** Classe de cor do selo (definidas em ordens.css). Desconhecido cai no neutro. */
export function tomDoStatus(status: string): string {
  return status in ROTULO_STATUS_OS && status !== 'rascunho' ? status : 'em_orcamento';
}

// ── Dados que moram dentro do payload da OS ──────────────────────────────────

/** `payload` chega do backend como string JSON (coluna text). */
function lerPayload(o: OrdemRow): any {
  const raw = o.payload;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw ?? {};
}

/** Primeiro nome do técnico (preenchido no encerramento da OS); null se ainda não há. */
export function mecanicoDaOrdem(o: OrdemRow): string | null {
  const nome = String(lerPayload(o)?.tecnico?.nome ?? '').trim();
  return nome ? nome.split(/\s+/)[0] : null;
}

/** "Chevrolet Onix 1.0 · 2021" (o ano só entra se a OS tiver). */
export function veiculoDaOrdem(o: OrdemRow): string {
  const ano = String(lerPayload(o)?.veiculo?.ano ?? '').trim();
  return [o.modelo, ano].filter(Boolean).join(' · ') || '—';
}

// ── Contas da tela ───────────────────────────────────────────────────────────

/** Carro na oficina agora — a mesma regra da Visão Geral (utils/ordem_status.naOficina). */
export const noPatio = (o: OrdemRow) => naOficina(o);

/** "17/11 · 08:40" */
export function formatarEntrada(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} · ${hora}`;
}

export type PeriodoEntrada = 'todos' | 'hoje' | '7d' | '30d';

export const ROTULO_PERIODO: Record<PeriodoEntrada, string> = {
  todos: 'Todo o período', hoje: 'Hoje', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias',
};

export function noPeriodo(o: OrdemRow, periodo: PeriodoEntrada): boolean {
  if (periodo === 'todos') return true;
  const entrada = new Date(o.created_at).getTime();
  if (Number.isNaN(entrada)) return false;
  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);
  const dias = periodo === 'hoje' ? 0 : periodo === '7d' ? 6 : 29;
  return entrada >= inicioHoje.getTime() - dias * 86_400_000;
}

export const ITENS_POR_PAGINA = 12;

// ── Filtros da lista no celular ──────────────────────────────────────────────
// "Todas" vem primeiro e é o padrão: abrir a lista nunca mostra uma tela vazia
// enquanto há OS. "Na oficina" usa a mesma regra da Visão Geral.

export type FiltroMobile = 'patio' | 'em_orcamento' | 'aguardando' | 'concluidas' | 'aprovadas' | 'recusadas' | 'todas';

export const FILTROS_MOBILE: readonly FiltroMobile[] = [
  'todas', 'patio', 'em_orcamento', 'aguardando', 'aprovadas', 'concluidas', 'recusadas',
];

export const ROTULO_FILTRO_MOBILE: Record<FiltroMobile, string> = {
  patio: 'Na oficina',
  em_orcamento: 'Em orçamento',
  aguardando: 'Aguardando',
  concluidas: 'Concluídas',
  aprovadas: 'Aprovadas',
  recusadas: 'Recusadas',
  todas: 'Todas',
};

export function noFiltroMobile(o: OrdemRow, f: FiltroMobile): boolean {
  const status = o.status;
  switch (f) {
    case 'patio': return naOficina(o);
    case 'em_orcamento': return status === 'rascunho' || status === 'em_orcamento';
    case 'aguardando': return status === 'pendente_aprovacao'; // aguardando aprovação do cliente
    case 'concluidas': return status === 'finalizada';
    case 'aprovadas': return status === 'aprovada';
    case 'recusadas': return status === 'recusada';
    default: return true;
  }
}

/** Seção da lista por data de entrada: hoje/ontem, últimos 7 dias, mais antigas. */
export type SecaoData = 'recentes' | 'semana' | 'antigas';

export const ROTULO_SECAO: Record<SecaoData, string> = {
  recentes: 'Hoje e ontem',
  semana: 'Esta semana',
  antigas: 'Anteriores',
};

export function secaoDaData(iso: string, agora: Date = new Date()): SecaoData {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'antigas';
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (dias <= 1) return 'recentes';
  if (dias <= 7) return 'semana';
  return 'antigas';
}
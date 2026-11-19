import type { OrdemRow } from '../../../types/dashboard';

// ── Filtros de status (chips) ─────────────────────────────────────────────────
// Um chip por status da OS. "rascunho" não tem chip próprio: entra em
// "Em orçamento" para os números dos chips fecharem com o total de "Todas".

export type FiltroStatus =
  | 'todas' | 'em_orcamento' | 'pendente_aprovacao' | 'aprovada'
  | 'em_execucao' | 'aguardando' | 'finalizada' | 'recusada';

export const FILTROS: readonly FiltroStatus[] = [
  'todas', 'em_orcamento', 'pendente_aprovacao', 'aprovada',
  'em_execucao', 'aguardando', 'finalizada', 'recusada',
];

export const ROTULO_FILTRO: Record<FiltroStatus, string> = {
  todas: 'Todas',
  em_orcamento: 'Em orçamento',
  pendente_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovadas',
  em_execucao: 'Em execução',
  aguardando: 'Aguardando peça',
  finalizada: 'Concluídas',
  recusada: 'Recusadas',
};

/** Status do banco -> chip em que ele conta. */
function grupoDoStatus(status: string): Exclude<FiltroStatus, 'todas'> | null {
  if (status === 'rascunho') return 'em_orcamento';
  return (FILTROS as readonly string[]).includes(status) && status !== 'todas'
    ? (status as Exclude<FiltroStatus, 'todas'>)
    : null;
}

export const noFiltro = (status: string, f: FiltroStatus) =>
  f === 'todas' || grupoDoStatus(status) === f;

// ── Rótulos e visual do status (tabela e filtros) ────────────────────────────

export const ROTULO_STATUS_OS: Record<string, string> = {
  rascunho: 'Em andamento',
  em_orcamento: 'Em orçamento',
  pendente_aprovacao: 'Aguardando aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em execução',
  aguardando: 'Aguardando peça',
  finalizada: 'Concluída',
  recusada: 'Recusada',
};

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

/** Carro parado na oficina agora: sendo consertado ou esperando peça. */
export const noPatio = (o: OrdemRow) => o.status === 'em_execucao' || o.status === 'aguardando';

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
// Os quatro primeiros são os do Figma mobile; os demais completam os status que
// ficariam sem chip ("No pátio" já cobre execução + aguardando peça).

export type FiltroMobile = 'patio' | 'em_orcamento' | 'aguardando' | 'concluidas' | 'aprovadas' | 'recusadas' | 'todas';

export const FILTROS_MOBILE: readonly FiltroMobile[] = [
  'patio', 'em_orcamento', 'aguardando', 'concluidas', 'aprovadas', 'recusadas', 'todas',
];

export const ROTULO_FILTRO_MOBILE: Record<FiltroMobile, string> = {
  patio: 'No pátio',
  em_orcamento: 'Em orçamento',
  aguardando: 'Aguardando',
  concluidas: 'Concluídas',
  aprovadas: 'Aprovadas',
  recusadas: 'Recusadas',
  todas: 'Todas',
};

export function noFiltroMobile(status: string, f: FiltroMobile): boolean {
  switch (f) {
    case 'patio': return status === 'em_execucao' || status === 'aguardando';
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
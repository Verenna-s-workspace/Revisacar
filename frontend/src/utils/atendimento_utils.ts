import type { Agendamento } from '../types/agendamento';
import type {
  ColunasKanban,
  ItemKanban,
  OSAtendimento,
  OSPrefillInput,
  OverlayMap,
  OverlayOS,
} from '../types/atendimento';
import type { OrdemRow } from '../types/dashboard';
import type { EstoqueItem, EstoqueKit } from '../types/estoque';
import type { ServicoItem } from '../types/servico';
import { isSameDay, toISODate } from './agenda';

/** payload às vezes vem como string (ver OrdensPage/OSModal) — parse defensivo compartilhado. */
export interface OrdemPayloadParcial {
  veiculo?: { ano?: string; cor?: string };
  servicos_selecionados?: string[];
}

export function parseOrdemPayload(ordem: OSAtendimento): OrdemPayloadParcial {
  let payload: unknown = ordem.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }
  return payload && typeof payload === 'object' ? (payload as OrdemPayloadParcial) : {};
}

// ── Overlay local (localStorage) ───────────────────────────────────────────────
// Por navegador, não sincroniza entre dispositivos/pessoas ainda — assim como
// tudo no projeto que ainda não tem endpoint próprio (ver Seção 3 do prompt).

const OVERLAY_STORAGE_KEY = 'revisacar:atendimento-overlay';

function lerTodosOverlaysBruto(): OverlayMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OverlayMap) : {};
  } catch {
    return {};
  }
}

function salvarTodosOverlaysBruto(mapa: OverlayMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    // localStorage indisponível (modo privado, quota cheia etc.) — falha
    // silenciosa, mesmo espírito do resto do app sem backend próprio pra isso.
  }
}

/** Lê o overlay inteiro (todas as OS) — usado pra mesclar uma lista de ordens de uma vez. */
export function lerTodosOverlays(): OverlayMap {
  return lerTodosOverlaysBruto();
}

/** Lê o overlay de uma única OS. */
export function lerOverlay(ordemId: string): OverlayOS | undefined {
  return lerTodosOverlaysBruto()[ordemId];
}

/** Mescla `patch` no overlay existente da OS (criando se ainda não houver) e persiste. */
export function salvarOverlay(ordemId: string, patch: Partial<Omit<OverlayOS, 'ordemId'>>): OverlayOS {
  const todos = lerTodosOverlaysBruto();
  const atual: OverlayOS = todos[ordemId] ?? { ordemId };
  const atualizado: OverlayOS = { ...atual, ...patch, ordemId };
  todos[ordemId] = atualizado;
  salvarTodosOverlaysBruto(todos);
  return atualizado;
}

/** Mescla o overlay (se houver) numa OrdemRow real — `{ ...ordem, ...overlay[ordem.id] }` sem o campo redundante `ordemId`. */
export function mesclarOverlayNaOrdem(ordem: OrdemRow, overlays: OverlayMap): OSAtendimento {
  const overlay = overlays[ordem.id];
  if (!overlay) return ordem;
  const { ordemId: _ordemId, ...campos } = overlay;
  return { ...ordem, ...campos };
}

// ── Derivação do Kanban (Seção 4 do prompt) ────────────────────────────────────
// Nenhum status novo de OS: as 4 colunas são derivadas combinando OS + Agendamento
// + overlay. "Em Execução" e a duração vêm só de `iniciadoEm`, nunca de um timer.

function chaveOrdenacaoFila(item: ItemKanban): string {
  return item.tipo === 'agendamento'
    ? `${item.agendamento.data}T${item.agendamento.horaInicio}`
    : item.ordem.created_at;
}

/**
 * Deriva as 4 colunas do Kanban a partir das ordens (já mescladas com overlay)
 * e dos agendamentos. Não recebe overlay diretamente — quem monta `ordens` já
 * aplicou `mesclarOverlayNaOrdem` em cada item (ver useAtendimento, Fase 2).
 */
export function derivarColunasKanban(ordens: OSAtendimento[], agendamentos: Agendamento[]): ColunasKanban {
  const hojeISO = toISODate(new Date());

  // Agendamentos de hoje sem OS ainda. Cancelados ficam de fora: um agendamento
  // cancelado não é trabalho esperando acontecer, mostrar na Fila confundiria
  // o mecânico — não é um status novo de OS, é só um filtro de leitura aqui.
  const agendamentosFila = agendamentos.filter(
    a => a.data === hojeISO && a.status !== 'cancelado' && !a.ordemServicoId
  );

  const osFila = ordens.filter(o => o.status === 'rascunho' && !o.iniciadoEm);
  const emExecucao = ordens.filter(o => o.status === 'rascunho' && !!o.iniciadoEm);
  const bloqueado = ordens.filter(o => o.status === 'aguardando');
  const concluidoHoje = ordens.filter(
    o => o.status === 'finalizada' && isSameDay(new Date(o.updated_at), new Date())
  );

  const fila: ItemKanban[] = [
    ...agendamentosFila.map((agendamento): ItemKanban => ({ tipo: 'agendamento', agendamento })),
    ...osFila.map((ordem): ItemKanban => ({ tipo: 'os', ordem })),
  ].sort((a, b) => chaveOrdenacaoFila(a).localeCompare(chaveOrdenacaoFila(b)));

  return {
    fila,
    em_execucao: emExecucao
      .slice()
      .sort((a, b) => (a.iniciadoEm ?? '').localeCompare(b.iniciadoEm ?? ''))
      .map((ordem): ItemKanban => ({ tipo: 'os', ordem })),
    bloqueado: bloqueado
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((ordem): ItemKanban => ({ tipo: 'os', ordem })),
    concluido: concluidoHoje
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((ordem): ItemKanban => ({ tipo: 'os', ordem })),
  };
}

/** Monta o prefill de "Iniciar Atendimento" (Seção 8) a partir de um agendamento. */
export function agendamentoParaPrefill(agendamento: Agendamento): OSPrefillInput {
  return {
    clienteNome: agendamento.cliente,
    veiculoModelo: agendamento.veiculo,
    veiculoPlaca: agendamento.placa,
    agendamentoId: agendamento.id,
  };
}

// ── Peças Necessárias (Seção 6) ────────────────────────────────────────────────
// Reaproveita 100% a integração Kit↔Catálogo já construída em Estoque — nenhum
// modelo de dado novo aqui. `servicos_selecionados` na OS guarda ids de seção
// do checklist (motor/freios/...), não nomes do Catálogo — mesma ambiguidade
// que já existe em extractTopServicos/SVC_PRECO (utils/relatorios.ts). O
// casamento abaixo é o mesmo "melhor esforço" por nome: funciona de ponta a
// ponta com dado demo (ver buildSeedOrdensAtendimento), pode não achar nada em
// produção — comportamento aceito pela Seção 6 ("não é obrigatório").
export function kitsVinculadosNaOrdem(ordem: OSAtendimento, kits: EstoqueKit[], servicos: ServicoItem[]): EstoqueKit[] {
  const selecionados = parseOrdemPayload(ordem).servicos_selecionados ?? [];
  if (selecionados.length === 0) return [];
  const nomesSelecionados = new Set(selecionados.map(s => s.toLowerCase().trim()));
  return kits.filter(kit => {
    if (!kit.servicoId) return false;
    const servico = servicos.find(s => s.id === kit.servicoId);
    return !!servico && nomesSelecionados.has(servico.nome.toLowerCase().trim());
  });
}

/** Total de itens de peça (linhas de receita, não soma de quantidade) nos kits vinculados — pro chip "📦 N itens". */
export function qtdPecasNaOrdem(ordem: OSAtendimento, kits: EstoqueKit[], servicos: ServicoItem[]): number {
  return kitsVinculadosNaOrdem(ordem, kits, servicos).reduce((soma, kit) => soma + kit.itens.length, 0);
}

/** Resolve os itens de um kit (nome/localização) a partir do catálogo de Estoque. */
export function itensDoKit(kit: EstoqueKit, itens: EstoqueItem[]): { item: EstoqueItem | undefined; quantidade: number; itemId: string }[] {
  const porId = new Map(itens.map(i => [i.id, i]));
  return kit.itens.map(receita => ({ item: porId.get(receita.itemId), quantidade: receita.quantidade, itemId: receita.itemId }));
}

// ── Histórico Express + alerta de retorno (Seção 6) ────────────────────────────
// Pura leitura do que a lista de ordens já traz — sem endpoint novo.

/** Últimas OS com a mesma placa, mais recentes primeiro, excluindo a atual. */
export function historicoExpressDaOrdem(ordem: OSAtendimento, todasOrdens: OSAtendimento[], limite = 3): OSAtendimento[] {
  return todasOrdens
    .filter(o => o.placa === ordem.placa && o.id !== ordem.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limite);
}

export function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

const JANELA_RETORNO_DIAS = 30;

/**
 * Se alguma OS do histórico (mesma placa) tiver created_at dentro de ~30 dias
 * e compartilhar ao menos 1 serviço com a OS atual, retorna essa OS (pra
 * montar "possível retorno do serviço de N dias atrás"). null se não achar.
 */
export function possivelRetornoNaOrdem(ordem: OSAtendimento, historico: OSAtendimento[]): OSAtendimento | null {
  const servicosAtuais = new Set(parseOrdemPayload(ordem).servicos_selecionados ?? []);
  if (servicosAtuais.size === 0) return null;
  return (
    historico.find(h => {
      const dias = diasDesde(h.created_at);
      if (dias < 0 || dias > JANELA_RETORNO_DIAS) return false;
      const servicosHistorico = parseOrdemPayload(h).servicos_selecionados ?? [];
      return servicosHistorico.some(s => servicosAtuais.has(s));
    }) ?? null
  );
}

/** "há 42min" / "há 1h20min" / "há 3d" — duração calculada, nunca cronometrada. */
export function formatDuracaoDesde(iso: string, agora: Date = new Date()): string {
  const inicio = new Date(iso).getTime();
  if (Number.isNaN(inicio)) return '';
  const diffMs = Math.max(0, agora.getTime() - inicio);
  const minutos = Math.floor(diffMs / 60000);

  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos}min`;

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  if (horas < 24) {
    return minutosRestantes > 0 ? `há ${horas}h${minutosRestantes}min` : `há ${horas}h`;
  }

  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

// ── Dados de demonstração (só em desenvolvimento) ──────────────────────────────
// Mesmo racional do useEstoque (import.meta.env.DEV): dado operacional errado
// em produção é tão arriscado quanto faturamento fictício — um mecânico vendo
// cards de clientes que não existem no meio da fila real é pior que uma tela
// vazia. Só cobre a metade "ordens"; os agendamentos de hoje já vêm do próprio
// fallback (sempre ligado) de useAgendamentos().

function minutosAtras(min: number): string {
  return new Date(Date.now() - min * 60 * 1000).toISOString();
}

function horasAtras(h: number): string {
  return minutosAtras(h * 60);
}

function diasAtrasComHora(dias: number, hora: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - dias);
  dt.setHours(hora, 0, 0, 0);
  return dt.toISOString();
}

/** OS de demonstração já "pré-mescladas" com overlay (é sintético, não passa pelo localStorage). */
export function buildSeedOrdensAtendimento(): OSAtendimento[] {
  return [
    {
      id: 'atd-seed-1',
      os_num: '1042',
      cliente: 'Marcos Almeida',
      placa: 'MKA3F71',
      modelo: 'VW Gol 1.6',
      status: 'rascunho',
      created_at: horasAtras(1),
      updated_at: horasAtras(1),
      payload: { veiculo: { ano: '2019', cor: 'Prata' }, servicos_selecionados: ['pneus'] },
    },
    {
      id: 'atd-seed-2',
      os_num: '1041',
      cliente: 'Fernanda Rocha',
      placa: 'FRC1G82',
      modelo: 'Honda Civic EXL',
      status: 'rascunho',
      created_at: horasAtras(3),
      updated_at: minutosAtras(42),
      iniciadoEm: minutosAtras(42),
      prioridade: 'vip',
      reclamacaoCliente: 'Barulho no motor ao dar partida a frio.',
      // Bate com o kit "Kit Troca de Óleo Completa" (servicoId '1') do seed de Estoque —
      // mostra a seção de Peças Necessárias funcionando de ponta a ponta em modo demo.
      payload: { veiculo: { ano: '2022', cor: 'Branco' }, servicos_selecionados: ['Troca de Óleo e Filtro'] },
    },
    {
      id: 'atd-seed-3',
      os_num: '1039',
      cliente: 'Paulo Henrique Souza',
      placa: 'PHS4D30',
      modelo: 'Fiat Toro Volcano',
      status: 'rascunho',
      created_at: horasAtras(5),
      updated_at: horasAtras(2),
      iniciadoEm: horasAtras(2),
      payload: { veiculo: { ano: '2021', cor: 'Cinza' }, servicos_selecionados: ['motor'] },
    },
    {
      id: 'atd-seed-4',
      os_num: '1036',
      cliente: 'Juliana Prado',
      placa: 'JPD8H55',
      modelo: 'Chevrolet Onix Plus',
      status: 'aguardando',
      created_at: horasAtras(9),
      updated_at: horasAtras(4),
      prioridade: 'garantia',
      reclamacaoCliente: 'Retornou com o mesmo barulho na suspensão dianteira.',
      observacoesInternas: 'Aguardando peça de fornecedor externo — previsão amanhã.',
      payload: { veiculo: { ano: '2020', cor: 'Vermelho' }, servicos_selecionados: ['suspensao'] },
    },
    {
      // Mesma placa da atd-seed-4, serviço parecido, 12 dias atrás — alimenta o
      // Histórico Express e o alerta de possível retorno (Fase 6).
      id: 'atd-seed-5',
      os_num: '0998',
      cliente: 'Juliana Prado',
      placa: 'JPD8H55',
      modelo: 'Chevrolet Onix Plus',
      status: 'finalizada',
      created_at: diasAtrasComHora(12, 9),
      updated_at: diasAtrasComHora(12, 17),
      clienteAvisado: true,
      payload: { veiculo: { ano: '2020', cor: 'Vermelho' }, servicos_selecionados: ['suspensao'] },
    },
    {
      id: 'atd-seed-6',
      os_num: '1044',
      cliente: 'Bruno Teixeira',
      placa: 'BTX2K19',
      modelo: 'Hyundai HB20 Comfort',
      status: 'finalizada',
      created_at: horasAtras(6),
      updated_at: horasAtras(1),
      clienteAvisado: true,
      payload: { veiculo: { ano: '2023', cor: 'Prata' }, servicos_selecionados: ['eletrica'] },
    },
    {
      // clienteAvisado não setado de propósito — é essa que acende o alerta vermelho.
      id: 'atd-seed-7',
      os_num: '1045',
      cliente: 'Camila Duarte',
      placa: 'CDT7M63',
      modelo: 'Renault Kwid Zen',
      status: 'finalizada',
      created_at: horasAtras(4),
      updated_at: minutosAtras(30),
      payload: { veiculo: { ano: '2022', cor: 'Laranja' }, servicos_selecionados: ['pneus'] },
    },
  ];
}

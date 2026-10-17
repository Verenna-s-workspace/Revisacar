// ── Alertas da oficina ───────────────────────────────────────────────────────
// Regra de "o que é um alerta" em UM lugar só: a tela de Alertas, o sino, o bloco
// da sidebar e o card do painel leem daqui (antes cada um recontava por conta).
//
// Cada tipo de alerta é uma FONTE registrada em FONTES_ALERTA. Pra incluir um tipo
// novo basta:
//   1. acrescentar o id em FonteAlertaId;
//   2. acrescentar a fonte na lista FONTES_ALERTA (a ordem da lista = ordem na tela);
//   3. se precisar de dado novo: do navegador, um campo em ContextoAlertas buscado em
//      hooks/useAlertas.ts; do banco, um bloco novo em GET /alertas (alertas_views.py)
//      e o tipo dele em types/alertas.ts.
// A tela não muda.

import { isSameDay } from './agenda';
import { formatDuracaoDesde, lerTodosOverlays, mesclarOverlayNaOrdem, momentoConclusao } from './atendimento_utils';
import { formatBRL } from './dashboard';
import { itemEstaBaixo, ordenarPorCriticidade } from './estoque_utils';
import { dataBR } from './orcamento_utils';
import type { OrdemRow, NavPage } from '../types/dashboard';
import type { EstoqueItem } from '../types/estoque';
import type { OverlayMap } from '../types/atendimento';
import type { AlertasBackend } from '../types/alertas';

export type SeveridadeAlerta = 'crit' | 'warn' | 'info';

export type FonteAlertaId =
  | 'os_bloqueada'
  | 'reserva_sem_estoque'
  | 'estoque_baixo'
  | 'os_sem_pagamento'
  | 'orcamento_sem_resposta'
  | 'cliente_nao_avisado'
  | 'os_aprovada_parada'
  | 'estoque_quarentena';

/** Pra onde o clique leva: uma tela do painel (opcionalmente já com busca) ou uma OS. */
export type DestinoAlerta =
  | { tipo: 'pagina'; page: NavPage; busca?: string }
  | { tipo: 'ordem'; ordemId: string };

export interface AcaoAlerta {
  rotulo: string;
  destino: DestinoAlerta;
}

export interface AlertaItem {
  /** Estável entre recargas (fonte + id do objeto) — serve de `key` e de chave pra "dispensar" no futuro. */
  id: string;
  fonte: FonteAlertaId;
  severidade: SeveridadeAlerta;
  titulo: string;
  detalhe?: string;
  acao: AcaoAlerta;
  acaoSecundaria?: AcaoAlerta;
}

/** Tudo que as fontes precisam pra calcular. Dado novo de fonte nova entra aqui. */
export interface ContextoAlertas {
  ordens: OrdemRow[];
  estoque: EstoqueItem[];
  /** Resposta de GET /alertas; null/ausente = não carregou (as fontes que dependem dela ficam vazias). */
  backend?: AlertasBackend | null;
  overlays?: OverlayMap;
  agora?: Date;
}

type ContextoCompleto = Required<Pick<ContextoAlertas, 'ordens' | 'estoque' | 'overlays' | 'agora'>> & {
  backend: AlertasBackend | null;
};

export interface FonteAlerta {
  id: FonteAlertaId;
  /** Título do grupo na tela (plural). */
  titulo: string;
  /** "3 ordens bloqueadas" / "1 ordem bloqueada" — usado no card do painel. */
  resumo: (n: number) => string;
  gerar: (ctx: ContextoCompleto) => AlertaItem[];
}

export interface GrupoAlertas {
  fonte: Pick<FonteAlerta, 'id' | 'titulo' | 'resumo'>;
  /** A mais grave entre as severidades dos itens do grupo. */
  severidade: SeveridadeAlerta;
  itens: AlertaItem[];
}

/** Dias sem receber a partir dos quais o alerta de pagamento passa a ser urgente. */
export const DIAS_PAGAMENTO_URGENTE = 7;

const umOuVarios = (um: string, varios: string) => (n: number) => `${n} ${n === 1 ? um : varios}`;
const rotuloOS = (o: { os_num?: string; osNum?: string }) => o.os_num || o.osNum || 'OS';
const veiculo = (o: { modelo?: string; placa?: string }) => [o.modelo, o.placa].filter(Boolean).join(' · ');
const maisAntigoPrimeiro = (a: OrdemRow, b: OrdemRow) =>
  new Date(momentoConclusao(a)).getTime() - new Date(momentoConclusao(b)).getTime();
const un = (n: number) => String(n).replace('.', ',');
const diasTxt = (n: number) => (n === 1 ? '1 dia' : `${n} dias`);
const abrirOS = (ordemId: string, rotulo = 'Abrir OS'): AcaoAlerta => ({ rotulo, destino: { tipo: 'ordem', ordemId } });
const irPara = (page: NavPage, rotulo: string, busca?: string): AcaoAlerta => ({ rotulo, destino: { tipo: 'pagina', page, busca } });

export const FONTES_ALERTA: FonteAlerta[] = [
  {
    id: 'os_bloqueada',
    titulo: 'Ordens bloqueadas',
    resumo: umOuVarios('ordem bloqueada', 'ordens bloqueadas'),
    gerar: ({ ordens, overlays, agora }) =>
      ordens
        .map(o => mesclarOverlayNaOrdem(o, overlays))
        .filter(o => o.status === 'aguardando')
        .sort(maisAntigoPrimeiro)
        .map(o => ({
          id: `os_bloqueada:${o.id}`,
          fonte: 'os_bloqueada' as const,
          severidade: 'crit' as const,
          titulo: `${rotuloOS(o)} · ${o.cliente}`,
          detalhe: [
            veiculo(o),
            o.motivoBloqueio ? `Motivo: ${o.motivoBloqueio}` : 'Aguardando liberação',
            formatDuracaoDesde(o.updated_at, agora),
          ].filter(Boolean).join(' — '),
          acao: irPara('atendimento', 'Ver no Atendimento'),
          acaoSecundaria: abrirOS(o.id),
        })),
  },
  {
    id: 'reserva_sem_estoque',
    titulo: 'Peças reservadas sem estoque',
    resumo: umOuVarios('peça reservada sem estoque suficiente', 'peças reservadas sem estoque suficiente'),
    gerar: ({ backend }) =>
      (backend?.reservasSemEstoque ?? []).map(r => ({
        id: `reserva_sem_estoque:${r.itemId}`,
        fonte: 'reserva_sem_estoque' as const,
        severidade: 'crit' as const,
        titulo: r.nome,
        detalhe: `Reservado ${un(r.reservado)}, em estoque ${un(r.emEstoque)} (faltam ${un(r.falta)})`
          + (r.ordens.length ? ` — ${r.ordens.map(x => x.osNum || 'OS').join(', ')}` : ''),
        acao: irPara('estoque', 'Ver no Estoque', r.nome),
      })),
  },
  {
    id: 'estoque_baixo',
    titulo: 'Estoque baixo',
    resumo: umOuVarios('item com estoque baixo', 'itens com estoque baixo'),
    gerar: ({ estoque }) =>
      ordenarPorCriticidade(estoque.filter(itemEstaBaixo)).map(i => ({
        id: `estoque_baixo:${i.id}`,
        fonte: 'estoque_baixo' as const,
        severidade: 'crit' as const,
        titulo: i.nome,
        detalhe: `${un(i.quantidade)} em estoque — mínimo ${un(i.minimo)}`,
        acao: irPara('estoque', 'Ver no Estoque', i.nome),
      })),
  },
  {
    id: 'os_sem_pagamento',
    titulo: 'Concluídas sem pagamento',
    resumo: umOuVarios('OS concluída sem pagamento', 'OS concluídas sem pagamento'),
    gerar: ({ backend }) =>
      (backend?.semPagamento ?? []).map(o => ({
        id: `os_sem_pagamento:${o.ordemId}`,
        fonte: 'os_sem_pagamento' as const,
        severidade: o.vencido || o.dias >= DIAS_PAGAMENTO_URGENTE ? ('crit' as const) : ('warn' as const),
        titulo: `${rotuloOS(o)} · ${o.cliente}`,
        detalhe: [
          veiculo(o),
          `${formatBRL(o.valorPendente)} a receber`,
          `concluída há ${diasTxt(o.dias)}`,
          o.vencido ? 'vencido' : '',
        ].filter(Boolean).join(' — '),
        acao: irPara('financeiro', 'Ver no Financeiro'),
        acaoSecundaria: abrirOS(o.ordemId),
      })),
  },
  {
    id: 'orcamento_sem_resposta',
    titulo: 'Orçamentos sem resposta',
    resumo: umOuVarios('orçamento sem resposta', 'orçamentos sem resposta'),
    gerar: ({ backend }) =>
      (backend?.orcamentosSemResposta ?? []).map(o => ({
        id: `orcamento_sem_resposta:${o.orcamentoId}`,
        fonte: 'orcamento_sem_resposta' as const,
        severidade: o.vencido ? ('crit' as const) : ('warn' as const),
        titulo: `${rotuloOS(o)} · ${o.cliente}`,
        detalhe: [
          veiculo(o),
          `Orçamento v${o.versao} · ${formatBRL(o.total)}`,
          o.vencido ? `vencido em ${dataBR(o.validadeAte ?? undefined)}` : `enviado há ${diasTxt(o.dias)}`,
        ].filter(Boolean).join(' — '),
        acao: abrirOS(o.ordemId, 'Abrir orçamento'),
      })),
  },
  {
    id: 'cliente_nao_avisado',
    titulo: 'Clientes para avisar',
    resumo: umOuVarios('cliente para avisar', 'clientes para avisar'),
    gerar: ({ ordens, overlays, agora }) =>
      ordens
        .map(o => mesclarOverlayNaOrdem(o, overlays))
        .filter(o => o.status === 'finalizada' && isSameDay(new Date(momentoConclusao(o)), agora) && o.clienteAvisado !== true)
        .sort(maisAntigoPrimeiro)
        .map(o => ({
          id: `cliente_nao_avisado:${o.id}`,
          fonte: 'cliente_nao_avisado' as const,
          severidade: 'warn' as const,
          titulo: `${rotuloOS(o)} · ${o.cliente}`,
          detalhe: [veiculo(o), `Serviço finalizado ${formatDuracaoDesde(momentoConclusao(o), agora)}`].filter(Boolean).join(' — '),
          acao: irPara('atendimento', 'Avisar no Atendimento'),
          acaoSecundaria: abrirOS(o.id),
        })),
  },
  {
    id: 'os_aprovada_parada',
    titulo: 'Aprovadas sem começar',
    resumo: umOuVarios('OS aprovada sem começar', 'OS aprovadas sem começar'),
    gerar: ({ backend }) =>
      (backend?.aprovadasParadas ?? []).map(o => ({
        id: `os_aprovada_parada:${o.ordemId}`,
        fonte: 'os_aprovada_parada' as const,
        severidade: 'warn' as const,
        titulo: `${rotuloOS(o)} · ${o.cliente}`,
        detalhe: [
          veiculo(o),
          o.total != null ? formatBRL(o.total) : '',
          `aprovada há ${diasTxt(o.dias)}, execução não iniciada`,
        ].filter(Boolean).join(' — '),
        acao: abrirOS(o.ordemId),
      })),
  },
  {
    id: 'estoque_quarentena',
    titulo: 'Itens em quarentena',
    resumo: umOuVarios('item em quarentena', 'itens em quarentena'),
    gerar: ({ estoque }) =>
      estoque
        .filter(i => i.status === 'quarentena')
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map(i => ({
          id: `estoque_quarentena:${i.id}`,
          fonte: 'estoque_quarentena' as const,
          severidade: 'warn' as const,
          titulo: i.nome,
          detalhe: i.quarentena?.motivo ? `Motivo: ${i.quarentena.motivo}` : 'Item separado, não pode ser usado',
          acao: irPara('estoque', 'Ver no Estoque', i.nome),
        })),
  },
];

/** Roda todas as fontes. Uma fonte que quebre não derruba as outras. */
export function gerarAlertas(ctx: ContextoAlertas, fontes: FonteAlerta[] = FONTES_ALERTA): AlertaItem[] {
  const completo: ContextoCompleto = {
    ordens: ctx.ordens,
    estoque: ctx.estoque,
    backend: ctx.backend ?? null,
    overlays: ctx.overlays ?? lerTodosOverlays(),
    agora: ctx.agora ?? new Date(),
  };
  return fontes.flatMap(f => {
    try {
      return f.gerar(completo);
    } catch {
      return [];
    }
  });
}

const PESO: Record<SeveridadeAlerta, number> = { crit: 3, warn: 2, info: 1 };

/** A mais grave entre as severidades dos alertas (info se não houver nenhum). */
export function maisGrave(itens: { severidade: SeveridadeAlerta }[]): SeveridadeAlerta {
  return itens.reduce<SeveridadeAlerta>((m, a) => (PESO[a.severidade] > PESO[m] ? a.severidade : m), 'info');
}

/** Agrupa na ordem das fontes, descarta grupos vazios e dá ao grupo a severidade do item mais grave. */
export function agruparAlertas(alertas: AlertaItem[], fontes: FonteAlerta[] = FONTES_ALERTA): GrupoAlertas[] {
  return fontes
    .map(f => {
      const itens = alertas.filter(a => a.fonte === f.id);
      return { fonte: { id: f.id, titulo: f.titulo, resumo: f.resumo }, severidade: maisGrave(itens), itens };
    })
    .filter(g => g.itens.length > 0);
}

export function contarPorFonte(alertas: AlertaItem[], id: FonteAlertaId): number {
  return alertas.filter(a => a.fonte === id).length;
}

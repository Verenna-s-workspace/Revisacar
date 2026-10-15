// ── Alertas da oficina ───────────────────────────────────────────────────────
// Regra de "o que é um alerta" em UM lugar só: a tela de Alertas, o sino, o bloco
// da sidebar e o card do painel leem daqui (antes cada um recontava por conta).
//
// Cada tipo de alerta é uma FONTE registrada em FONTES_ALERTA. Pra incluir um tipo
// novo (ex.: orçamento vencido, lançamento pendente) basta:
//   1. acrescentar o id em FonteAlertaId;
//   2. acrescentar a fonte na lista FONTES_ALERTA (a ordem da lista = ordem na tela);
//   3. se precisar de dado novo, acrescentar o campo em ContextoAlertas e buscá-lo
//      em hooks/useAlertas.ts.
// A tela não muda.

import { isSameDay } from './agenda';
import { formatDuracaoDesde, lerTodosOverlays, mesclarOverlayNaOrdem } from './atendimento_utils';
import { itemEstaBaixo, ordenarPorCriticidade } from './estoque_utils';
import type { OrdemRow, NavPage } from '../types/dashboard';
import type { EstoqueItem } from '../types/estoque';
import type { OverlayMap } from '../types/atendimento';

export type SeveridadeAlerta = 'crit' | 'warn' | 'info';

export type FonteAlertaId =
  | 'os_bloqueada'
  | 'estoque_baixo'
  | 'cliente_nao_avisado'
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
  overlays?: OverlayMap;
  agora?: Date;
}

export interface FonteAlerta {
  id: FonteAlertaId;
  /** Título do grupo na tela (plural). */
  titulo: string;
  severidade: SeveridadeAlerta;
  gerar: (ctx: Required<Pick<ContextoAlertas, 'ordens' | 'estoque' | 'overlays' | 'agora'>>) => AlertaItem[];
}

export interface GrupoAlertas {
  fonte: Pick<FonteAlerta, 'id' | 'titulo' | 'severidade'>;
  itens: AlertaItem[];
}

const rotuloOS = (o: OrdemRow) => o.os_num || 'OS';
const veiculoDe = (o: OrdemRow) => [o.modelo, o.placa].filter(Boolean).join(' · ');
const maisAntigoPrimeiro = (a: OrdemRow, b: OrdemRow) =>
  new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
const un = (n: number) => String(n).replace('.', ',');

export const FONTES_ALERTA: FonteAlerta[] = [
  {
    id: 'os_bloqueada',
    titulo: 'Ordens bloqueadas',
    severidade: 'crit',
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
            veiculoDe(o),
            o.motivoBloqueio ? `Motivo: ${o.motivoBloqueio}` : 'Aguardando liberação',
            formatDuracaoDesde(o.updated_at, agora),
          ].filter(Boolean).join(' — '),
          acao: { rotulo: 'Ver no Atendimento', destino: { tipo: 'pagina' as const, page: 'atendimento' as const } },
          acaoSecundaria: { rotulo: 'Abrir OS', destino: { tipo: 'ordem' as const, ordemId: o.id } },
        })),
  },
  {
    id: 'estoque_baixo',
    titulo: 'Estoque baixo',
    severidade: 'crit',
    gerar: ({ estoque }) =>
      ordenarPorCriticidade(estoque.filter(itemEstaBaixo)).map(i => ({
        id: `estoque_baixo:${i.id}`,
        fonte: 'estoque_baixo' as const,
        severidade: 'crit' as const,
        titulo: i.nome,
        detalhe: `${un(i.quantidade)} em estoque — mínimo ${un(i.minimo)}`,
        acao: { rotulo: 'Ver no Estoque', destino: { tipo: 'pagina' as const, page: 'estoque' as const, busca: i.nome } },
      })),
  },
  {
    id: 'cliente_nao_avisado',
    titulo: 'Clientes para avisar',
    severidade: 'warn',
    gerar: ({ ordens, overlays, agora }) =>
      ordens
        .map(o => mesclarOverlayNaOrdem(o, overlays))
        .filter(o => o.status === 'finalizada' && isSameDay(new Date(o.updated_at), agora) && o.clienteAvisado !== true)
        .sort(maisAntigoPrimeiro)
        .map(o => ({
          id: `cliente_nao_avisado:${o.id}`,
          fonte: 'cliente_nao_avisado' as const,
          severidade: 'warn' as const,
          titulo: `${rotuloOS(o)} · ${o.cliente}`,
          detalhe: [veiculoDe(o), `Serviço finalizado ${formatDuracaoDesde(o.updated_at, agora)}`].filter(Boolean).join(' — '),
          acao: { rotulo: 'Avisar no Atendimento', destino: { tipo: 'pagina' as const, page: 'atendimento' as const } },
          acaoSecundaria: { rotulo: 'Abrir OS', destino: { tipo: 'ordem' as const, ordemId: o.id } },
        })),
  },
  {
    id: 'estoque_quarentena',
    titulo: 'Itens em quarentena',
    severidade: 'warn',
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
          acao: { rotulo: 'Ver no Estoque', destino: { tipo: 'pagina' as const, page: 'estoque' as const, busca: i.nome } },
        })),
  },
];

/** Roda todas as fontes. Uma fonte que quebre não derruba as outras. */
export function gerarAlertas(ctx: ContextoAlertas, fontes: FonteAlerta[] = FONTES_ALERTA): AlertaItem[] {
  const completo = {
    ordens: ctx.ordens,
    estoque: ctx.estoque,
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

/** Agrupa na ordem das fontes e descarta grupos vazios. */
export function agruparAlertas(alertas: AlertaItem[], fontes: FonteAlerta[] = FONTES_ALERTA): GrupoAlertas[] {
  return fontes
    .map(f => ({ fonte: { id: f.id, titulo: f.titulo, severidade: f.severidade }, itens: alertas.filter(a => a.fonte === f.id) }))
    .filter(g => g.itens.length > 0);
}

export function contarPorFonte(alertas: AlertaItem[], id: FonteAlertaId): number {
  return alertas.filter(a => a.fonte === id).length;
}

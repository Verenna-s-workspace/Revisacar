// Regras da fase DIAGNÓSTICO da OS (sem React): contagens por sistema, estado das sub-etapas e lista "para trocar".
// A lógica de dados (selected, checklist, trocaSet, tabelaPecas) continua toda no hook useOrdemServico.
import { SECTIONS } from '../constants';
import type { Section, TabelaPeca } from '../types';
import type { EtapaFase } from './os_fases';

/** Sub-etapas (os.step): 1 Serviços (sistemas) · 2 Diagnóstico · 3 Peças · 4 Texto. */
export const ETAPA_DIAG = { servicos: 1, diagnostico: 2, pecas: 3, texto: 4 } as const;

export type ChecklistMap = Record<string, { status: string | null; obs: string }>;

export const ID_PERSONALIZADA = 'adicionais';

/** Itens de um sistema: os da lista fixa, ou os que o usuário digitou (sistema personalizado). */
export const itensDoSistema = (sec: Section, itensAdicionais: string[]): string[] =>
  sec.isDynamic ? itensAdicionais : sec.items;

export interface ContagemSistema {
  total: number; feitos: number; pendentes: number; crit: number; warn: number; completo: boolean;
}

export function contagemDoSistema(sec: Section, checklist: ChecklistMap, itensAdicionais: string[]): ContagemSistema {
  const itens = itensDoSistema(sec, itensAdicionais);
  let feitos = 0; let crit = 0; let warn = 0;
  for (const n of itens) {
    const st = checklist[`${sec.id}:${n}`]?.status ?? null;
    if (st) feitos += 1;
    if (st === 'crit') crit += 1;
    if (st === 'warn') warn += 1;
  }
  return { total: itens.length, feitos, pendentes: itens.length - feitos, crit, warn, completo: itens.length > 0 && feitos === itens.length };
}

/** Sistemas da OS, na ordem do catálogo fixo. */
export const sistemasSelecionados = (selected: Set<string>): Section[] => SECTIONS.filter((s) => selected.has(s.id));

/** Chaves (`sistema:item`) de itens SEM status em um sistema. */
export function chavesPendentes(sec: Section, checklist: ChecklistMap, itensAdicionais: string[]): string[] {
  return itensDoSistema(sec, itensAdicionais)
    .map((n) => `${sec.id}:${n}`)
    .filter((k) => !checklist[k]?.status);
}

/** Itens Críticos sem observação escrita (o painel avisa; não bloqueia). */
export function criticosSemObs(selected: Set<string>, checklist: ChecklistMap, itensAdicionais: string[]): string[] {
  const out: string[] = [];
  for (const sec of sistemasSelecionados(selected)) {
    for (const n of itensDoSistema(sec, itensAdicionais)) {
      const d = checklist[`${sec.id}:${n}`];
      if (d?.status === 'crit' && !d.obs.trim()) out.push(`${sec.id}:${n}`);
    }
  }
  return out;
}

/** Nome do item a partir da chave `sistema:item` (o nome pode conter ":"). */
export const nomeDaChave = (key: string): string => key.slice(key.indexOf(':') + 1);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export interface EntradaDiagnostico {
  sistemas: number;
  total: number; feitos: number; crit: number; semObs: number;
  pecas: Pick<TabelaPeca, 'id'>[];
}

/** Estado das 4 sub-etapas. Nenhuma é bloqueada (as abas antigas também deixavam ir e voltar livremente). */
export function etapasDoDiagnostico(e: EntradaDiagnostico): EtapaFase[] {
  const diagCompleto = e.total > 0 && e.feitos === e.total;
  return [
    {
      id: ETAPA_DIAG.servicos, rotulo: 'Serviços', bloqueada: false,
      estado: e.sistemas > 0 ? 'completa' : 'pendente',
      detalhe: e.sistemas > 0 ? plural(e.sistemas, 'sistema', 'sistemas') : 'Nenhum sistema escolhido',
    },
    {
      id: ETAPA_DIAG.diagnostico, rotulo: 'Diagnóstico', bloqueada: false,
      estado: diagCompleto ? 'completa' : 'pendente',
      detalhe: e.total > 0 ? `${e.feitos} de ${e.total} itens` : 'Sem itens para inspecionar',
      pendencia: e.semObs > 0 ? `${plural(e.semObs, 'crítico', 'críticos')} sem observação` : undefined,
    },
    {
      id: ETAPA_DIAG.pecas, rotulo: 'Peças', bloqueada: false,
      estado: e.pecas.length > 0 ? 'completa' : 'opcional',
      detalhe: e.pecas.length > 0 ? plural(e.pecas.length, 'peça', 'peças') : 'Nenhuma peça para troca',
    },
    {
      id: ETAPA_DIAG.texto, rotulo: 'Texto', bloqueada: false,
      estado: e.pecas.length > 0 ? 'pendente' : 'opcional',
      detalhe: e.pecas.length > 0 ? 'Texto das peças pronto para copiar' : 'Sem peças para listar',
    },
  ];
}

/** Texto gerado a partir da tabela de peças (etapa Texto) — o mesmo formato de sempre. */
export function textoDasPecas(pecas: readonly TabelaPeca[]): string {
  if (pecas.length === 0) return '';
  const lines: string[] = ['Peças:'];
  for (const p of pecas) {
    lines.push('');
    if (p.peca)       lines.push(`Peça: ${p.peca}`);
    if (p.modelo)     lines.push(`Modelo: ${p.modelo}`);
    if (p.marca)      lines.push(`Marca: ${p.marca}`);
    if (p.codigo)     lines.push(`Código: ${p.codigo}`);
    if (p.quantidade) lines.push(`Quantidade: ${p.quantidade}`);
  }
  return lines.join('\n');
}

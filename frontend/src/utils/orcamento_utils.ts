// ── Orçamento da OS (etapa 3): funções puras ──────────────────────────────────
// Sem React, sem rede — tudo aqui é testável e roda igual no navegador e no Node.

import { SECTIONS } from '../constants';
import type { EstoqueItem } from '../types/estoque';
import type { ServicoItem } from '../types/servico';
import type {
  CanalAprovacao, EfeitosOrcamento, ItemRascunho, Orcamento, OrcamentoItem, StatusOrcamento, TipoItemOrcamento,
} from '../types/orcamento';

// ── Rótulos ───────────────────────────────────────────────────────────────────

export const ROTULO_STATUS_ORCAMENTO: Record<StatusOrcamento, string> = {
  rascunho: 'Rascunho',
  enviado: 'Aguardando o cliente',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  substituido: 'Substituído',
};

export const ROTULO_CANAL: Record<CanalAprovacao, string> = {
  whatsapp: 'WhatsApp',
  presencial: 'Presencialmente',
  telefone: 'Telefone',
  app: 'Aplicativo',
  link: 'Link do orçamento',
  outro: 'Outro',
};

/** Canais que a OFICINA pode registrar (o canal 'link' só o link público grava). */
export const CANAIS: CanalAprovacao[] = ['whatsapp', 'presencial', 'telefone', 'app', 'outro'];

/** Limites do servidor (serializers.py) — validar antes poupa uma ida e volta. */
export const LIMITES = {
  descricao: 300, marca: 100, motivo: 500, observacoes: 2000, itens: 100,
  quantidadeMax: 9_999_999, valorMax: 99_999_999,
} as const;

// ── Números ───────────────────────────────────────────────────────────────────

/** "1.234,56" / "1234,5" / "12.5" → número. Vazio ou inválido → null. */
export function lerNumero(texto: string): number | null {
  let t = (texto ?? '').trim().replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Número → texto que o campo mostra ("1,5"); sem zeros à toa. */
export function numeroParaCampo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(n).replace('.', ',');
}

/**
 * quantidade × preço, em centavos, arredondando meia-unidade pra cima — mesma
 * conta do servidor (`round(quantidade * preco_unitario, 2)` no Postgres).
 * Em inteiros (BigInt): 1,5 × 10,01 = 15,015 tem que dar 15,02, e em ponto
 * flutuante daria 15,01.
 */
export function subtotalEmCentavos(quantidade: number, preco: number): number {
  const milesimos = BigInt(Math.round(quantidade * 1000));
  const centavos = BigInt(Math.round(preco * 100));
  return Number((milesimos * centavos + 500n) / 1000n);
}

export function subtotalDoItem(item: Pick<ItemRascunho, 'quantidade' | 'precoUnitario'>): number {
  const q = lerNumero(item.quantidade);
  const p = lerNumero(item.precoUnitario);
  if (q == null || p == null || q <= 0 || p < 0) return 0;
  return subtotalEmCentavos(q, p) / 100;
}

export function totalDosItens(itens: Pick<ItemRascunho, 'quantidade' | 'precoUnitario'>[]): number {
  const centavos = itens.reduce((soma, i) => {
    const q = lerNumero(i.quantidade);
    const p = lerNumero(i.precoUnitario);
    if (q == null || p == null || q <= 0 || p < 0) return soma;
    return soma + subtotalEmCentavos(q, p);
  }, 0);
  return centavos / 100;
}

/** Custo total (só dos itens com custo informado) — pra quem vê margem. */
export function custoDosItens(itens: Pick<ItemRascunho, 'quantidade' | 'custoUnitario'>[]): number {
  const centavos = itens.reduce((soma, i) => {
    const q = lerNumero(i.quantidade);
    const c = lerNumero(i.custoUnitario);
    if (q == null || c == null || q <= 0 || c < 0) return soma;
    return soma + subtotalEmCentavos(q, c);
  }, 0);
  return centavos / 100;
}

// ── Itens em edição ───────────────────────────────────────────────────────────

let contador = 0;
export function novaChave(): string {
  contador += 1;
  return `i${Date.now().toString(36)}${contador}`;
}

export function itemVazio(tipo: TipoItemOrcamento): ItemRascunho {
  return {
    chave: novaChave(), tipo, descricao: '', marca: '', quantidade: '1',
    precoUnitario: '', custoUnitario: '', motivo: '',
  };
}

/** Item gravado no servidor → item de edição. */
export function itemDoServidor(item: OrcamentoItem): ItemRascunho {
  return {
    chave: item.id || novaChave(),
    id: item.id,
    tipo: item.tipo,
    descricao: item.descricao,
    marca: item.marca,
    quantidade: numeroParaCampo(item.quantidade),
    precoUnitario: numeroParaCampo(item.precoUnitario),
    custoUnitario: numeroParaCampo(item.custoUnitario),
    motivo: item.motivo,
    estoqueItemId: item.estoqueItemId,
    servicoId: item.servicoId,
  };
}

export function itensDoOrcamento(orc: Pick<Orcamento, 'itens'> | null | undefined): ItemRascunho[] {
  return (orc?.itens ?? []).map(itemDoServidor);
}

/**
 * Itens de edição → corpo do PATCH. `custoUnitario` só vai se o usuário enxerga
 * custo: quem não enxerga nunca recebeu o valor, e omitir a chave faz o servidor
 * manter o custo já gravado (item com `id`).
 */
export function itensParaPayload(itens: ItemRascunho[], podeVerCusto: boolean): Record<string, unknown>[] {
  return itens.map(i => {
    const out: Record<string, unknown> = {
      tipo: i.tipo,
      descricao: i.descricao.trim(),
      marca: i.marca.trim(),
      quantidade: lerNumero(i.quantidade) ?? 0,
      precoUnitario: lerNumero(i.precoUnitario) ?? 0,
      motivo: i.motivo.trim(),
    };
    if (i.id) out.id = i.id;
    if (i.estoqueItemId) out.estoqueItemId = i.estoqueItemId;
    if (i.servicoId) out.servicoId = i.servicoId;
    if (podeVerCusto) out.custoUnitario = lerNumero(i.custoUnitario);
    return out;
  });
}

export type ErrosItens = Record<string, string>;

/** Erros por `chave` do item. Vazio = pode enviar. */
export function validarItens(itens: ItemRascunho[]): ErrosItens {
  const erros: ErrosItens = {};
  if (itens.length > LIMITES.itens) erros._geral = `No máximo ${LIMITES.itens} itens por orçamento.`;
  for (const i of itens) {
    const q = lerNumero(i.quantidade);
    const p = lerNumero(i.precoUnitario);
    const c = lerNumero(i.custoUnitario);
    if (!i.descricao.trim()) erros[i.chave] = 'Informe a descrição.';
    else if (i.descricao.trim().length > LIMITES.descricao) erros[i.chave] = `Descrição com mais de ${LIMITES.descricao} caracteres.`;
    else if (q == null || q <= 0) erros[i.chave] = 'A quantidade precisa ser maior que zero.';
    else if (q > LIMITES.quantidadeMax) erros[i.chave] = 'Quantidade grande demais.';
    else if (i.precoUnitario.trim() !== '' && (p == null || p < 0)) erros[i.chave] = 'Preço inválido.';
    else if (p != null && p > LIMITES.valorMax) erros[i.chave] = 'Preço grande demais.';
    else if (i.custoUnitario.trim() !== '' && (c == null || c < 0)) erros[i.chave] = 'Custo inválido.';
    else if (i.marca.trim().length > LIMITES.marca) erros[i.chave] = `Marca com mais de ${LIMITES.marca} caracteres.`;
    else if (i.motivo.trim().length > LIMITES.motivo) erros[i.chave] = `Motivo com mais de ${LIMITES.motivo} caracteres.`;
  }
  return erros;
}

/** Item sem preço entra como R$ 0,00 — pra ENVIAR ao cliente isso quase sempre é esquecimento. */
export function itensSemPreco(itens: ItemRascunho[]): ItemRascunho[] {
  return itens.filter(i => (lerNumero(i.precoUnitario) ?? 0) <= 0);
}

/** Dois conjuntos de itens iguais (pra saber se há alteração não salva). */
export function mesmosItens(a: ItemRascunho[], b: ItemRascunho[]): boolean {
  if (a.length !== b.length) return false;
  const chaves = (i: ItemRascunho) => JSON.stringify([
    i.tipo, i.descricao.trim(), i.marca.trim(), lerNumero(i.quantidade), lerNumero(i.precoUnitario),
    lerNumero(i.custoUnitario), i.motivo.trim(), i.estoqueItemId ?? null, i.servicoId ?? null,
  ]);
  return a.every((item, n) => chaves(item) === chaves(b[n]));
}

// ── Casamento de nomes (diagnóstico × Estoque × Catálogo) ─────────────────────

/** minúsculas, sem acento, espaços e pontuação colapsados. */
export function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const TAMANHO_MIN_PARCIAL = 4;

/**
 * Acha UM item pelo nome: igualdade (sem acento/caixa) ganha; senão aceita o
 * candidato cujo nome CONTÉM o que foi digitado ("Filtro de óleo" → "Filtro de
 * óleo Bosch"), só quando isso aponta pra exatamente um — na dúvida, não casa
 * (melhor o usuário escolher do que levar a peça errada). O sentido contrário
 * ("Óleo" no estoque casando com "Filtro de óleo") é proibido de propósito:
 * nome genérico do cadastro engoliria peças diferentes.
 */
export function casarPorNome<T>(nome: string, candidatos: T[], nomeDe: (c: T) => string): T | null {
  const alvo = normalizar(nome);
  if (!alvo) return null;
  const iguais = candidatos.filter(c => normalizar(nomeDe(c)) === alvo);
  if (iguais.length >= 1) return iguais[0];
  if (alvo.length < TAMANHO_MIN_PARCIAL) return null;
  const parciais = candidatos.filter(c => {
    const n = normalizar(nomeDe(c));
    return n.includes(alvo);
  });
  return parciais.length === 1 ? parciais[0] : null;
}

export function casarComEstoque(nome: string, estoque: EstoqueItem[]): EstoqueItem | null {
  return casarPorNome(nome, estoque.filter(e => e.status === 'ativo'), e => e.nome);
}

export function casarComCatalogo(nome: string, catalogo: ServicoItem[]): ServicoItem | null {
  return casarPorNome(nome, catalogo.filter(s => s.ativo), s => s.nome);
}

/** Item de peça preenchido com um item do Estoque (nome, preço e vínculo). */
export function aplicarItemDoEstoque(item: ItemRascunho, e: EstoqueItem): ItemRascunho {
  return { ...item, descricao: e.nome, precoUnitario: numeroParaCampo(e.preco), estoqueItemId: e.id };
}

/** Item de serviço preenchido com um serviço do Catálogo. */
export function aplicarServicoDoCatalogo(item: ItemRascunho, s: ServicoItem): ItemRascunho {
  return { ...item, descricao: s.nome, precoUnitario: numeroParaCampo(s.preco), servicoId: s.id };
}

// ── Pré-preenchimento a partir das etapas 1 e 2 ───────────────────────────────

/** O que o orçamento lê da OS (o payload salvo; só estes campos). */
export interface DadosDaOS {
  tabelaPecas: { id?: string; peca: string; modelo?: string; marca?: string; codigo?: string; quantidade?: string; sourceKey?: string }[];
  checklist: Record<string, { status: string | null; obs: string }>;
}

function rotuloDoApontamento(status: string | null | undefined): string {
  if (status === 'crit') return 'Crítico no diagnóstico';
  if (status === 'warn') return 'Atenção no diagnóstico';
  return '';
}

/**
 * Peças da tabela do diagnóstico (etapa 2) → itens de peça do orçamento.
 * Quantidade vazia/zerada vira 1. O motivo vem da observação do item do
 * checklist que gerou a troca (ou do estado dele). Se achar a peça no Estoque
 * (nome igual, ou parecido sem ambiguidade), já traz o preço e o vínculo.
 */
export function pecasDoDiagnostico(dados: DadosDaOS, estoque: EstoqueItem[]): ItemRascunho[] {
  const saida: ItemRascunho[] = [];
  for (const linha of dados.tabelaPecas) {
    const nome = (linha.peca ?? '').trim();
    if (!nome) continue;
    const q = lerNumero(String(linha.quantidade ?? ''));
    const origem = linha.sourceKey ? dados.checklist[linha.sourceKey] : undefined;
    let item: ItemRascunho = {
      chave: novaChave(),
      tipo: 'peca',
      descricao: nome,
      marca: (linha.marca ?? '').trim(),
      quantidade: numeroParaCampo(q != null && q > 0 ? q : 1),
      precoUnitario: '',
      custoUnitario: '',
      motivo: (origem?.obs ?? '').trim() || rotuloDoApontamento(origem?.status),
      doDiagnostico: true,
    };
    const noEstoque = casarComEstoque(nome, estoque);
    if (noEstoque) {
      // Mantém o que o mecânico escreveu como descrição: ele sabe o que pediu.
      item = { ...aplicarItemDoEstoque(item, noEstoque), descricao: nome };
    }
    saida.push(item);
  }
  return saida;
}

/**
 * Acrescenta as peças do diagnóstico que ainda não estão no orçamento (compara
 * pelo nome, sem acento/caixa). Nunca mexe no que já existe — serve tanto pra
 * montar o primeiro rascunho quanto pra "trazer de novo" depois de mexer no diagnóstico.
 */
export function mesclarPecasDoDiagnostico(atuais: ItemRascunho[], doDiagnostico: ItemRascunho[]): ItemRascunho[] {
  const jaTem = new Set(atuais.filter(i => i.tipo === 'peca').map(i => normalizar(i.descricao)));
  const novos = doDiagnostico.filter(i => !jaTem.has(normalizar(i.descricao)));
  return [...atuais, ...novos];
}

export interface Apontamento {
  /** "motor:Filtro de ar" */
  chave: string;
  secao: string;
  nome: string;
  status: 'crit' | 'warn';
  obs: string;
}

/**
 * Itens do diagnóstico marcados como Crítico/Atenção que ainda não têm peça nem
 * serviço no orçamento — viram sugestões (crítico primeiro). O que já virou peça
 * (linha da tabela com esse `sourceKey`) ou aparece na descrição/motivo de um
 * item do orçamento não é sugerido de novo.
 */
export function apontamentosDoDiagnostico(dados: DadosDaOS, itens: ItemRascunho[]): Apontamento[] {
  const chavesComPeca = new Set(dados.tabelaPecas.map(l => l.sourceKey).filter(Boolean) as string[]);
  const textoDoOrcamento = itens.map(i => normalizar(`${i.descricao} ${i.motivo}`));
  const rotuloSecao = new Map(SECTIONS.map(s => [s.id, s.label]));

  const lista: Apontamento[] = [];
  for (const [chave, v] of Object.entries(dados.checklist)) {
    if (v.status !== 'crit' && v.status !== 'warn') continue;
    if (chavesComPeca.has(chave)) continue;
    const corte = chave.indexOf(':');
    if (corte < 0) continue;
    const secaoId = chave.slice(0, corte);
    const nome = chave.slice(corte + 1);
    const n = normalizar(nome);
    if (n && textoDoOrcamento.some(t => t.includes(n))) continue;
    lista.push({
      chave, secao: rotuloSecao.get(secaoId) ?? (secaoId === 'adicionais' ? 'Adicionais' : secaoId),
      nome, status: v.status, obs: (v.obs ?? '').trim(),
    });
  }
  return lista.sort((a, b) => (a.status === b.status ? 0 : a.status === 'crit' ? -1 : 1) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Sugestão → item de serviço (traz preço do Catálogo se achar o serviço sem ambiguidade). */
export function servicoDoApontamento(a: Apontamento, catalogo: ServicoItem[]): ItemRascunho {
  const base: ItemRascunho = {
    ...itemVazio('servico'),
    descricao: a.nome,
    motivo: a.obs || rotuloDoApontamento(a.status),
    doDiagnostico: true,
  };
  const noCatalogo = casarComCatalogo(a.nome, catalogo);
  return noCatalogo ? { ...aplicarServicoDoCatalogo(base, noCatalogo), descricao: noCatalogo.nome } : base;
}

/** Lê do payload salvo da OS só o que o orçamento usa. */
export function dadosDoPayload(payload: unknown): DadosDaOS {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const tabela = Array.isArray(p.tabela_pecas) ? p.tabela_pecas : [];
  const checklist = p.checklist && typeof p.checklist === 'object' ? (p.checklist as DadosDaOS['checklist']) : {};
  return { tabelaPecas: tabela as DadosDaOS['tabelaPecas'], checklist };
}

// ── Versões e validade ────────────────────────────────────────────────────────

/** A versão "em foco": o rascunho, senão a mais nova. A lista vem da mais nova pra mais antiga. */
export function versaoAtual(versoes: Orcamento[]): Orcamento | null {
  return versoes.find(v => v.status === 'rascunho') ?? versoes[0] ?? null;
}

/** "2026-10-19" → "19/10/2026". */
export function dataBR(iso: string | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}

/** Fuso do navegador (a validade do orçamento conta em dias nesse fuso). */
export function fusoDoNavegador(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// ── Efeitos no Financeiro e no Estoque ────────────────────────────────────────

const ROTULO_CATEGORIA = { pecas: 'Peças', servicos: 'Serviços' } as const;

function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function unidades(n: number): string {
  return String(n).replace('.', ',');
}

/** Texto (uma frase por linha) do que a operação fez, e o tom do aviso: 'warn' se pede atenção. */
export function resumoEfeitos(efeitos: EfeitosOrcamento | undefined | null): { linhas: string[]; tom: 'ok' | 'warn' } | null {
  if (!efeitos) return null;
  const linhas: string[] = [];
  const porAcao = (acao: string) => efeitos.financeiro
    .filter(f => f.acao === acao)
    .map(f => `${ROTULO_CATEGORIA[f.categoria]} ${brl(f.valor)}`)
    .join(' · ');
  const criados = porAcao('criado');
  const atualizados = porAcao('atualizado');
  const cancelados = porAcao('cancelado');
  if (criados) linhas.push(`Lançamento pendente criado no Financeiro: ${criados}.`);
  if (atualizados) linhas.push(`Lançamento pendente atualizado no Financeiro: ${atualizados}.`);
  if (cancelados) linhas.push(`Lançamento cancelado no Financeiro: ${cancelados}.`);
  if (efeitos.reservas > 0) {
    linhas.push(`${efeitos.reservas} ${efeitos.reservas === 1 ? 'item reservado' : 'itens reservados'} no Estoque.`);
  }
  if (efeitos.liberadas > 0) linhas.push('Reserva do Estoque liberada.');
  for (const f of efeitos.faltas) {
    linhas.push(`Estoque insuficiente de "${f.nome}": reservado ${unidades(f.reservado)}, disponível ${unidades(f.disponivel)} — será preciso comprar o restante.`);
  }
  for (const a of efeitos.avisos) {
    linhas.push(`O lançamento de ${ROTULO_CATEGORIA[a.categoria].toLowerCase()} já está pago e não foi alterado — ajuste no Financeiro, se precisar.`);
  }
  if (linhas.length === 0) return null;
  return { linhas, tom: efeitos.faltas.length > 0 || efeitos.avisos.length > 0 ? 'warn' : 'ok' };
}


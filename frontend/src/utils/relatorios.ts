import type { OrdemRow } from '../types/dashboard';
import type {
  DiaRelatorio,
  Granularidade,
  IntervaloDatas,
  PeriodoPreset,
  PontoSerieTemporal,
  RelatorioResposta,
  ServicoContado,
  ServicoRealizado,
  TotaisPeriodo,
} from '../types/relatorios';

/* ────────────────────────────────────────────────────────────────────────── */
/* Valorização da OS                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Ticket usado como fallback quando a OS não tem nenhum serviço reconhecido
 * na tabela de preços abaixo. Visão Geral e Relatórios agora calculam isso no
 * servidor (relatorios_views.py usa o mesmo valor); aqui sobra para o modo
 * demo e para "Gastos estimados" no perfil do cliente.
 */
export const TICKET = 480;

/** Tabela de preços por nome de serviço — espelho da tabela do servidor (relatorios_views.py). */
export const SVC_PRECO: Record<string, number> = {
  'Troca de Óleo': 180,
  Freios: 320,
  Suspensão: 450,
  Alinhamento: 150,
  'Ar Condicionado': 280,
  Elétrica: 200,
  Motor: 800,
  Transmissão: 600,
  Pneus: 120,
  Funilaria: 900,
};

/**
 * `payload` é coluna `text` no banco: do backend chega como STRING JSON, não
 * como objeto. Ler `payload.servicos_selecionados` direto dava sempre
 * `undefined` fora do modo demo — por isso o parse aqui.
 */
function servicosDaOrdem(ordem: OrdemRow): string[] {
  let payload: unknown = ordem.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return [];
    }
  }
  const lista = (payload as { servicos_selecionados?: unknown } | null | undefined)?.servicos_selecionados;
  return Array.isArray(lista) ? lista.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
}

function estimativaAtual(ordem: OrdemRow): number {
  const servicos = servicosDaOrdem(ordem);
  if (servicos.length === 0) return TICKET;
  const total = servicos.reduce((soma, nome) => soma + (SVC_PRECO[nome] ?? 0), 0);
  return total > 0 ? total : TICKET;
}

/**
 * Valor estimado de uma OS (soma por serviço selecionado, ou o ticket padrão
 * quando nenhum serviço é reconhecido na tabela).
 *
 * Na tela de Relatórios, quem calcula faturamento agora é o servidor
 * (GET /relatorios: entradas do Financeiro, ou esta mesma estimativa quando a
 * oficina ainda não lança entradas — a tabela do servidor é espelho desta, em
 * relatorios_views.py). Esta função só sobrevive para o modo demo (DEV com a
 * API fora do ar) e para quem usa `valor_total` de OS.
 *
 * Nota: esta estimativa (soma por serviço) é mais granular do que a usada
 * hoje na Visão Geral (nº de OS finalizadas × R$480 fixo). A Visão Geral
 * continua com a conta simples de propósito, para não mudar um número que
 * o usuário já vê hoje.
 */
export function valorOS(ordem: OrdemRow): number {
  return ordem.valor_total ?? estimativaAtual(ordem);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Datas e períodos                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDoDia(data: Date): Date {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

function adicionarDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Número de dias corridos entre duas datas, inclusive em ambas as pontas. */
function contarDias(inicio: Date, fim: Date): number {
  const ms = inicioDoDia(fim).getTime() - inicioDoDia(inicio).getTime();
  return Math.round(ms / DIA_MS) + 1;
}

/** Resolve um preset de período para um intervalo de datas concreto. */
export function resolverIntervalo(preset: PeriodoPreset, personalizado?: IntervaloDatas): IntervaloDatas {
  const hoje = new Date();

  switch (preset) {
    case 'hoje':
      return { inicio: inicioDoDia(hoje), fim: fimDoDia(hoje) };

    case 'ultimos_7_dias':
      return { inicio: inicioDoDia(adicionarDias(hoje, -6)), fim: fimDoDia(hoje) };

    case 'ultimos_30_dias':
      return { inicio: inicioDoDia(adicionarDias(hoje, -29)), fim: fimDoDia(hoje) };

    case 'este_mes': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { inicio: inicioDoDia(inicio), fim: fimDoDia(hoje) };
    }

    case 'mes_passado': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // dia 0 = último dia do mês anterior
      return { inicio: inicioDoDia(inicio), fim: fimDoDia(fim) };
    }

    case 'personalizado': {
      if (!personalizado) return resolverIntervalo('ultimos_30_dias');
      const [inicio, fim] =
        personalizado.inicio <= personalizado.fim
          ? [personalizado.inicio, personalizado.fim]
          : [personalizado.fim, personalizado.inicio];
      return { inicio: inicioDoDia(inicio), fim: fimDoDia(fim) };
    }

    default:
      return resolverIntervalo('ultimos_30_dias');
  }
}

/**
 * Calcula o período anterior equivalente, para comparação.
 *
 * - "Hoje", "Últimos N dias" e "Personalizado": desloca o intervalo inteiro
 *   para trás pelo mesmo número de dias (ex.: 10–16/abr → 03–09/abr).
 * - "Este mês": compara com o mesmo número de dias no mês anterior (dia 1 até
 *   o dia N), para não comparar um mês parcial com um mês inteiro.
 * - "Mês passado": compara com o mês civil anterior a ele (mês inteiro
 *   contra mês inteiro).
 */
export function resolverIntervaloAnterior(preset: PeriodoPreset, intervaloAtual: IntervaloDatas): IntervaloDatas {
  if (preset === 'este_mes') {
    const { inicio, fim } = intervaloAtual;
    const inicioMesAnterior = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(inicio.getFullYear(), inicio.getMonth(), 0).getDate();
    const diaEquivalente = Math.min(fim.getDate(), ultimoDiaMesAnterior);
    const fimMesAnterior = new Date(inicioMesAnterior.getFullYear(), inicioMesAnterior.getMonth(), diaEquivalente);
    return { inicio: inicioDoDia(inicioMesAnterior), fim: fimDoDia(fimMesAnterior) };
  }

  if (preset === 'mes_passado') {
    const { inicio } = intervaloAtual;
    const inicioAnterior = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
    const fimAnterior = new Date(inicio.getFullYear(), inicio.getMonth(), 0);
    return { inicio: inicioDoDia(inicioAnterior), fim: fimDoDia(fimAnterior) };
  }

  // hoje / últimos_7_dias / últimos_30_dias / personalizado → desloca pelo tamanho do período
  const tamanho = contarDias(intervaloAtual.inicio, intervaloAtual.fim);
  const fimAnterior = adicionarDias(intervaloAtual.inicio, -1);
  const inicioAnterior = adicionarDias(fimAnterior, -(tamanho - 1));
  return { inicio: inicioDoDia(inicioAnterior), fim: fimDoDia(fimAnterior) };
}

export function formatarIntervalo(intervalo: IntervaloDatas): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return `${intervalo.inicio.toLocaleDateString('pt-BR', opts)} – ${intervalo.fim.toLocaleDateString('pt-BR', opts)}`;
}

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function formatarMes(data: Date): string {
  return NOMES_MES[data.getMonth()];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Granularidade e buckets                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function determinarGranularidade(intervalo: IntervaloDatas): Granularidade {
  const dias = contarDias(intervalo.inicio, intervalo.fim);
  if (dias <= 7) return 'dia';
  if (dias <= 90) return 'semana';
  return 'mes';
}

interface Bucket {
  inicio: Date;
  fim: Date;
  rotulo: string;
}

function formatarDiaMes(data: Date): string {
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function gerarBucketsDiarios(intervalo: IntervaloDatas): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = inicioDoDia(intervalo.inicio);
  while (cursor <= intervalo.fim) {
    buckets.push({ inicio: cursor, fim: fimDoDia(cursor), rotulo: formatarDiaMes(cursor) });
    cursor = adicionarDias(cursor, 1);
  }
  return buckets;
}

/**
 * Buckets semanais: blocos de 7 dias corridos a partir do início do período
 * selecionado (não semanas ISO seg-dom, para não depender de que o início
 * do período caia numa segunda-feira). O último bloco pode ficar menor —
 * ele aparece normalmente, sem ser completado artificialmente para 7 dias
 * (ex.: 01-07, 08-14, 15-21, 22-28, 29-30 num período de 30 dias).
 */
function gerarBucketsSemanais(intervalo: IntervaloDatas): Bucket[] {
  const buckets: Bucket[] = [];
  let cursorInicio = inicioDoDia(intervalo.inicio);
  while (cursorInicio <= intervalo.fim) {
    const candidatoFim = fimDoDia(adicionarDias(cursorInicio, 6));
    const fimBloco = candidatoFim < intervalo.fim ? candidatoFim : intervalo.fim;
    const mesmoMes = cursorInicio.getMonth() === fimBloco.getMonth();
    const rotulo = mesmoMes
      ? `${String(cursorInicio.getDate()).padStart(2, '0')}-${String(fimBloco.getDate()).padStart(2, '0')}`
      : `${formatarDiaMes(cursorInicio)}-${formatarDiaMes(fimBloco)}`;
    buckets.push({ inicio: cursorInicio, fim: fimBloco, rotulo });
    cursorInicio = inicioDoDia(adicionarDias(fimBloco, 1));
  }
  return buckets;
}

function gerarBucketsMensais(intervalo: IntervaloDatas): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = new Date(intervalo.inicio.getFullYear(), intervalo.inicio.getMonth(), 1);
  while (cursor <= intervalo.fim) {
    const fimMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const inicioBucket = cursor > intervalo.inicio ? cursor : intervalo.inicio;
    const fimBucket = fimMes < intervalo.fim ? fimMes : intervalo.fim;
    buckets.push({
      inicio: inicioDoDia(inicioBucket),
      fim: fimDoDia(fimBucket),
      rotulo: `${formatarMes(cursor).slice(0, 3)}/${cursor.getFullYear()}`,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return buckets;
}

function gerarBuckets(intervalo: IntervaloDatas, granularidade: Granularidade): Bucket[] {
  if (granularidade === 'dia') return gerarBucketsDiarios(intervalo);
  if (granularidade === 'semana') return gerarBucketsSemanais(intervalo);
  return gerarBucketsMensais(intervalo);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Séries temporais (faturamento e contagem de OS)                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** YYYY-MM-DD no fuso local — mesma chave que o servidor devolve em `dia`. */
export function chaveDia(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function somarDiasDoBucket(dias: DiaRelatorio[], bucket: Bucket, extrair: (d: DiaRelatorio) => number): number {
  // Chaves YYYY-MM-DD comparam certo como texto.
  const inicio = chaveDia(bucket.inicio);
  const fim = chaveDia(bucket.fim);
  return dias.reduce((soma, d) => (d.dia >= inicio && d.dia <= fim ? soma + extrair(d) : soma), 0);
}

/**
 * Monta a série temporal comparando período atual × período anterior,
 * bucket a bucket, alinhados por posição relativa (o 1º bucket do período
 * atual é comparado ao 1º bucket do período anterior — não por data).
 * Parte dos dias já agregados pelo servidor; aqui só agrupa em dia/semana/mês.
 */
export function montarSerieDeDias(
  dias: DiaRelatorio[],
  intervaloAtual: IntervaloDatas,
  intervaloAnterior: IntervaloDatas,
  extrair: (d: DiaRelatorio) => number
): PontoSerieTemporal[] {
  const granularidade = determinarGranularidade(intervaloAtual);
  const bucketsAtual = gerarBuckets(intervaloAtual, granularidade);
  const bucketsAnterior = gerarBuckets(intervaloAnterior, granularidade);
  const tamanho = Math.max(bucketsAtual.length, bucketsAnterior.length);

  const pontos: PontoSerieTemporal[] = [];
  for (let i = 0; i < tamanho; i++) {
    const bAtual = bucketsAtual[i];
    const bAnterior = bucketsAnterior[i];
    pontos.push({
      rotulo: bAtual ? bAtual.rotulo : bAnterior?.rotulo ?? '',
      atual: bAtual ? somarDiasDoBucket(dias, bAtual, extrair) : null,
      anterior: bAnterior ? somarDiasDoBucket(dias, bAnterior, extrair) : null,
    });
  }
  return pontos;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Serviços mais realizados                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const LIMITE_SERVICOS_EXIBIDOS = 8;

/** Calcula % do total e junta a cauda em "Outros". `servicos` já vem contado (do servidor ou da agregação demo). */
export function agruparServicosMaisRealizados(servicos: ServicoContado[]): ServicoRealizado[] {
  const total = servicos.reduce((s, x) => s + x.quantidade, 0);
  const ordenado = servicos
    .map(({ nome, quantidade }) => ({ nome, quantidade, percentual: total > 0 ? (quantidade / total) * 100 : 0 }))
    .sort((a, b) => b.quantidade - a.quantidade);

  if (ordenado.length <= LIMITE_SERVICOS_EXIBIDOS) return ordenado;

  const principais = ordenado.slice(0, LIMITE_SERVICOS_EXIBIDOS - 1);
  const outros = ordenado.slice(LIMITE_SERVICOS_EXIBIDOS - 1);
  const quantidadeOutros = outros.reduce((s, o) => s + o.quantidade, 0);
  principais.push({
    nome: 'Outros',
    quantidade: quantidadeOutros,
    percentual: total > 0 ? (quantidadeOutros / total) * 100 : 0,
  });
  return principais;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Agregação local (só modo demo)                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Mesma agregação que o servidor faz (GET /relatorios), sobre uma lista de OS
 * em memória — usada APENAS no modo demo (DEV com a API fora do ar), para a
 * tela ter um único caminho de renderização: sempre parte de RelatorioResposta.
 * Faturamento = estimativa por OS finalizada.
 */
export function agregarOrdensLocal(
  ordens: OrdemRow[],
  atual: IntervaloDatas,
  anterior: IntervaloDatas
): RelatorioResposta {
  const porDia = new Map<string, DiaRelatorio>();
  const contagem = new Map<string, number>();
  const inicio = Math.min(atual.inicio.getTime(), anterior.inicio.getTime());
  const fim = Math.max(atual.fim.getTime(), anterior.fim.getTime());

  for (const o of ordens) {
    const t = new Date(o.created_at).getTime();
    if (Number.isNaN(t) || t < inicio || t > fim) continue;
    const chave = chaveDia(new Date(t));
    const d = porDia.get(chave) ?? { dia: chave, ordens: 0, finalizadas: 0, faturamento: 0 };
    d.ordens += 1;
    if (o.status === 'finalizada') {
      d.finalizadas += 1;
      d.faturamento += valorOS(o);
      if (t >= atual.inicio.getTime() && t <= atual.fim.getTime()) {
        servicosDaOrdem(o).forEach((nome) => contagem.set(nome, (contagem.get(nome) ?? 0) + 1));
      }
    }
    porDia.set(chave, d);
  }

  const dias = Array.from(porDia.values()).sort((a, b) => a.dia.localeCompare(b.dia));
  const totais = (intervalo: IntervaloDatas): TotaisPeriodo => {
    const ini = chaveDia(intervalo.inicio);
    const fimChave = chaveDia(intervalo.fim);
    return dias
      .filter((d) => d.dia >= ini && d.dia <= fimChave)
      .reduce(
        (t, d) => ({
          faturamento: t.faturamento + d.faturamento,
          ordens: t.ordens + d.ordens,
          finalizadas: t.finalizadas + d.finalizadas,
        }),
        { faturamento: 0, ordens: 0, finalizadas: 0 }
      );
  };
  const totalAnterior = totais(anterior);

  return {
    faturamentoOrigem: 'estimado',
    totais: { atual: totais(atual), anterior: totalAnterior.ordens > 0 ? totalAnterior : null },
    dias,
    servicos: Array.from(contagem.entries()).map(([nome, quantidade]) => ({ nome, quantidade })),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Comparação percentual                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Retorna null quando não há período anterior com dados — nesses casos a UI
 * deve ocultar a comparação em vez de mostrar um "+100%"/"-100%" enganoso
 * (ex.: primeiro dia de uso do sistema).
 */
export function calcularVariacao(atual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Formatação                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function formatarPercentual(valor: number): string {
  const sinal = valor > 0 ? '+' : '';
  return `${sinal}${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Dados de demonstração                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const SEED_CLIENTES = [
  'Carlos Eduardo Oliveira', 'Roberto Mendes Albuquerque', 'Mariana Costa Ribeiro',
  'Bruno Alves Teixeira', 'Ana Paula Ferreira', 'Pedro Henrique Souza',
  'Juliana Martins Rocha', 'Fernando Lima Barros', 'Camila Rodrigues Nunes',
  'Rafael Santos Cardoso', 'Beatriz Almeida Pires', 'Gustavo Henrique Dias',
];

const SEED_MODELOS = ['Onix', 'HB20', 'Corolla', 'Civic', 'Gol', 'Polo', 'Compass', 'Renegade', 'Kicks', 'Argo'];
const SEED_PLACAS = ['ABC1D23', 'BRA2E19', 'MER4K05', 'RIO7X88', 'SPX3Q41', 'VLC9M12'];
const SEED_SERVICOS = Object.keys(SVC_PRECO);

// pesos maiores = serviço aparece mais vezes, pra render de "mais realizados"
// não ficar uma linha reta chata
const PESOS_SERVICO = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 5, 6, 7, 8];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function servicosAleatorios(seed: number): string[] {
  const qtd = 1 + (seed % 2);
  const nomes = new Set<string>();
  let s = seed;
  while (nomes.size < qtd) {
    const idx = PESOS_SERVICO[Math.abs(s) % PESOS_SERVICO.length] % SEED_SERVICOS.length;
    nomes.add(SEED_SERVICOS[idx]);
    s = s * 7 + 13;
  }
  return Array.from(nomes);
}

/**
 * Gera OS de demonstração com datas relativas a "agora" (últimos ~75 dias),
 * pra todos os filtros de período (hoje, 7 dias, 30 dias, este mês, mês
 * passado) sempre terem o que mostrar. Só entra em uso quando a API real
 * falha (backend fora do ar, sem sessão válida, Supabase não configurado) —
 * mesmo padrão de buildSeedClientes() / buildSeedVeiculos() já usado no
 * projeto para as telas que ainda não têm backend.
 */
export function buildSeedOrdens(): OrdemRow[] {
  const agora = Date.now();
  const diasAtrasList: number[] = [];

  for (let d = 0; d <= 74; d++) {
    if (d % 5 === 4) continue; // "folgas" — nem todo dia tem OS, fica mais realista
    const porDia = d < 14 ? 2 : d < 45 ? 1 : d % 3 === 0 ? 1 : 0;
    for (let i = 0; i < porDia; i++) diasAtrasList.push(d);
  }

  return diasAtrasList.map((diasAtras, i) => {
    const criadoEm = new Date(agora - diasAtras * DIA_MS);
    criadoEm.setHours(8 + (i % 9), (i * 7) % 60, 0, 0);

    const statusRoll = i % 10;
    const status = statusRoll < 7 ? 'finalizada' : statusRoll < 9 ? 'aguardando' : 'rascunho';

    return {
      id: `seed-os-${i + 1}`,
      os_num: `OS-DEMO-${String(i + 1).padStart(4, '0')}`,
      cliente: pick(SEED_CLIENTES, i),
      placa: pick(SEED_PLACAS, i + 3),
      modelo: pick(SEED_MODELOS, i + 5),
      status,
      created_at: criadoEm.toISOString(),
      updated_at: criadoEm.toISOString(),
      payload: { servicos_selecionados: servicosAleatorios(i + 1) },
    };
  });
}

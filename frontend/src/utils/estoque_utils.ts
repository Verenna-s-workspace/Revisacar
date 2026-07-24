// ── Estoque: utilitários e dados de demonstração ──────────────────────────────

import type {
  EstoqueItem,
  EstoqueKit,
  ItemEstoqueMovimentado,
  MovimentoEstoque,
} from '../types/estoque';

// ── Categorias ──────────────────────────────────────────────────────────────
//
// Lista plana no modelo de dados (EstoqueItem.categoria é `string`) — o
// agrupamento abaixo é só apresentação, pro grid de tiles. Ajustável à
// vontade; o que importa é manter alinhado com as categorias que já existem
// no Catálogo de Serviços (Freios, Suspensão, Motor, Elétrica, Transmissão,
// Pneus, Funilaria), pra o vínculo Kit ↔ Serviço (Fase 6) fazer sentido.

export const CATEGORIA_GRUPOS: { grupo: string; categorias: string[] }[] = [
  { grupo: 'Rodas e Pneus',      categorias: ['Pneus', 'Calotas', 'Rodas'] },
  { grupo: 'Motor',              categorias: ['Motor', 'Lubrificantes', 'Filtros', 'Correias', 'Elétrica'] },
  { grupo: 'Freios e Suspensão', categorias: ['Freios', 'Suspensão', 'Fluidos'] },
  { grupo: 'Interior',           categorias: ['Volante', 'Bancos', 'Acessórios'] },
  { grupo: 'Funilaria',          categorias: ['Funilaria'] },
];

export const CATEGORIAS_FLAT: string[] = CATEGORIA_GRUPOS.flatMap(g => g.categorias);

// ── Regras de negócio ─────────────────────────────────────────────────────────

/**
 * Disponibilidade de um kit = o menor `floor(quantidade do item / quantidade
 * da receita)` entre todos os componentes. Um item em quarentena, ausente ou
 * com receita inválida zera a disponibilidade do kit inteiro — sem isso um
 * kit poderia parecer "montável" usando peças que na prática não podem sair
 * (ver seção de Quarentena: itens em quarentena não contam na disponibilidade).
 */
export function calcularDisponibilidadeKit(
  kit: Pick<EstoqueKit, 'itens'>,
  itensPorId: Map<string, EstoqueItem>
): number {
  if (kit.itens.length === 0) return 0;

  let disponibilidade = Infinity;
  for (const receita of kit.itens) {
    const item = itensPorId.get(receita.itemId);
    if (!item || item.status === 'quarentena' || receita.quantidade <= 0) return 0;
    disponibilidade = Math.min(disponibilidade, Math.floor(item.quantidade / receita.quantidade));
  }
  return disponibilidade === Infinity ? 0 : disponibilidade;
}

/** Baixo estoque = ativo, com `minimo` configurado, e quantidade <= minimo. */
export function itemEstaBaixo(item: EstoqueItem): boolean {
  return item.status === 'ativo' && item.minimo > 0 && item.quantidade <= item.minimo;
}

/**
 * Ordena por `quantidade / minimo` crescente (mais crítico primeiro);
 * desempate por nome (localeCompare pt-BR) pra sempre haver uma resposta
 * única sobre "quais são os N mais críticos".
 */
export function ordenarPorCriticidade(itens: EstoqueItem[]): EstoqueItem[] {
  return [...itens].sort((a, b) => {
    const ra = a.quantidade / a.minimo;
    const rb = b.quantidade / b.minimo;
    if (ra !== rb) return ra - rb;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

/** Todos os itens em baixo estoque, já ordenados por criticidade. */
export function itensCriticos(itens: EstoqueItem[]): EstoqueItem[] {
  return ordenarPorCriticidade(itens.filter(itemEstaBaixo));
}

/** Valor total em estoque — itens em quarentena não contam. */
export function valorTotalEstoque(itens: EstoqueItem[]): number {
  return itens
    .filter(i => i.status === 'ativo')
    .reduce((soma, i) => soma + i.preco * i.quantidade, 0);
}

export interface ResumoQuarentena {
  valorTotal: number;
  totalPecas: number;
  itensEmQuarentena: number;
  diasMaisAntigo: number;
}

/** `null` quando não há nenhum item em quarentena. */
export function resumoQuarentena(itens: EstoqueItem[]): ResumoQuarentena | null {
  const emQuarentena = itens.filter(i => i.status === 'quarentena' && i.quarentena);
  if (emQuarentena.length === 0) return null;

  const valorTotal = emQuarentena.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const totalPecas = emQuarentena.reduce((s, i) => s + i.quantidade, 0);
  const maisAntigoTs = emQuarentena.reduce((mais, i) => {
    const t = new Date(i.quarentena!.dataEntrada).getTime();
    return t < mais ? t : mais;
  }, Infinity);
  const diasMaisAntigo = Math.max(0, Math.floor((Date.now() - maisAntigoTs) / (24 * 60 * 60 * 1000)));

  return { valorTotal, totalPecas, itensEmQuarentena: emQuarentena.length, diasMaisAntigo };
}

/** Busca por nome OU aplicação (não só nome). */
export function filtrarItensPorBusca(itens: EstoqueItem[], termo: string): EstoqueItem[] {
  const q = termo.trim().toLowerCase();
  if (!q) return itens;
  return itens.filter(
    i => i.nome.toLowerCase().includes(q) || (i.aplicacao ?? '').toLowerCase().includes(q)
  );
}

const LIMITE_ITENS_MOVIMENTADOS_EXIBIDOS = 8;

/**
 * Mesma forma/composição de `calcularServicosMaisRealizados` em
 * utils/relatorios.ts (bucket "Outros" acima do limite) — só que soma
 * `quantidade` de MovimentoEstoque do tipo 'saida' por item (não 'entrada'
 * nem 'ajuste' — ver comentário em hooks/useEstoque.ts), dentro do
 * `intervalo` recebido de useRelatorios().intervaloAtual. Movimentos de um
 * item que não existe mais são ignorados.
 */
export function itensMaisMovimentados(
  movimentos: MovimentoEstoque[],
  itens: EstoqueItem[],
  intervalo: { inicio: Date; fim: Date }
): ItemEstoqueMovimentado[] {
  const itensPorId = new Map(itens.map(i => [i.id, i]));
  const inicioTs = intervalo.inicio.getTime();
  const fimTs = intervalo.fim.getTime();

  const contagem = new Map<string, number>(); // itemId -> quantidade
  let total = 0;

  movimentos.forEach(m => {
    if (m.tipo !== 'saida') return;
    const t = new Date(m.criadoEm).getTime();
    if (t < inicioTs || t > fimTs) return;
    if (!itensPorId.has(m.itemId)) return;
    contagem.set(m.itemId, (contagem.get(m.itemId) ?? 0) + m.quantidade);
    total += m.quantidade;
  });

  const ordenado = Array.from(contagem.entries())
    .map(([itemId, quantidade]) => {
      const item = itensPorId.get(itemId)!;
      return { nome: item.nome, categoria: item.categoria, quantidade, percentual: total > 0 ? (quantidade / total) * 100 : 0 };
    })
    .sort((a, b) => b.quantidade - a.quantidade);

  if (ordenado.length <= LIMITE_ITENS_MOVIMENTADOS_EXIBIDOS) return ordenado;

  const principais = ordenado.slice(0, LIMITE_ITENS_MOVIMENTADOS_EXIBIDOS - 1);
  const outros = ordenado.slice(LIMITE_ITENS_MOVIMENTADOS_EXIBIDOS - 1);
  const quantidadeOutros = outros.reduce((s, o) => s + o.quantidade, 0);
  principais.push({
    nome: 'Outros',
    categoria: '',
    quantidade: quantidadeOutros,
    percentual: total > 0 ? (quantidadeOutros / total) * 100 : 0,
  });
  return principais;
}

// ── Foto: compressão no navegador ──────────────────────────────────────────────
//
// Sem backend de storage ainda — a foto vira data URL e vive só no estado da
// sessão. Redimensiona pra largura máxima ~480px e recomprime como JPEG
// qualidade ~0.7 antes de guardar, pra não inflar o estado com base64 de
// fotos de câmera em resolução alta.

export function comprimirImagem(file: File, maxWidth = 480, qualidade = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
      img.onload = () => {
        const escala = Math.min(1, maxWidth / img.width);
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível neste navegador.'));
          return;
        }
        ctx.drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(file);
  });
}

// ── Dados de demonstração ───────────────────────────────────────────────────
//
// Só usados em desenvolvimento, quando a API real falha (ver hooks/useEstoque.ts
// — fallback restrito a import.meta.env.DEV, diferente de Veículos/Catálogo).

function diasAtras(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export function buildSeedEstoque(): EstoqueItem[] {
  const base: Array<Omit<EstoqueItem, 'status' | 'createdAt' | 'quarentena'> & { diasCriacao: number }> = [
    { id: 'est-1',  nome: 'Pneu Aro 14 175/70 R14',              categoria: 'Pneus',         quantidade: 12, minimo: 4,  preco: 320.0, localizacao: 'Prateleira A1', aplicacao: 'Gol 1.0/1.6, Onix 1.0, HB20 1.0', diasCriacao: 120 },
    { id: 'est-2',  nome: 'Pneu Aro 15 185/65 R15',               categoria: 'Pneus',         quantidade: 3,  minimo: 4,  preco: 380.0, localizacao: 'Prateleira A2', aplicacao: 'Corolla, Civic, HB20S',            diasCriacao: 120 },
    { id: 'est-3',  nome: 'Calota Aro 14 Universal',              categoria: 'Calotas',       quantidade: 20, minimo: 6,  preco: 45.0,  localizacao: 'Prateleira A3', diasCriacao: 110 },
    { id: 'est-4',  nome: 'Roda Liga Leve Aro 15',                categoria: 'Rodas',         quantidade: 2,  minimo: 2,  preco: 450.0, localizacao: 'Prateleira A4', diasCriacao: 110 },
    { id: 'est-5',  nome: 'Óleo Motor 5W30 Sintético 1L',         categoria: 'Lubrificantes', quantidade: 30, minimo: 10, preco: 42.0,  localizacao: 'Armário B1',    diasCriacao: 100 },
    { id: 'est-6',  nome: 'Óleo Motor 20W50 Mineral 1L',          categoria: 'Lubrificantes', quantidade: 5,  minimo: 8,  preco: 28.0,  localizacao: 'Armário B1',    diasCriacao: 100 },
    { id: 'est-7',  nome: 'Filtro de Óleo',                       categoria: 'Filtros',       quantidade: 25, minimo: 10, preco: 22.0,  localizacao: 'Armário B2',    aplicacao: 'Gol 1.6, Voyage 1.6, Fox 1.6',     diasCriacao: 95 },
    { id: 'est-8',  nome: 'Filtro de Ar',                         categoria: 'Filtros',       quantidade: 18, minimo: 8,  preco: 35.0,  localizacao: 'Armário B2',    diasCriacao: 95 },
    { id: 'est-9',  nome: 'Correia Dentada',                      categoria: 'Correias',      quantidade: 6,  minimo: 4,  preco: 85.0,  localizacao: 'Armário B3',    diasCriacao: 90 },
    { id: 'est-10', nome: 'Vela de Ignição (unidade)',            categoria: 'Elétrica',      quantidade: 40, minimo: 16, preco: 18.0,  localizacao: 'Armário B4',    diasCriacao: 90 },
    { id: 'est-11', nome: 'Bateria 60Ah',                         categoria: 'Elétrica',      quantidade: 4,  minimo: 3,  preco: 480.0, localizacao: 'Armário B4',    diasCriacao: 85 },
    { id: 'est-12', nome: 'Pastilha de Freio Dianteira',          categoria: 'Freios',        quantidade: 14, minimo: 6,  preco: 95.0,  localizacao: 'Prateleira C1', aplicacao: 'Gol 1.6 2016-2019, Voyage 1.6 2015-2018', diasCriacao: 80 },
    { id: 'est-13', nome: 'Disco de Freio Dianteiro',             categoria: 'Freios',        quantidade: 1,  minimo: 4,  preco: 160.0, localizacao: 'Prateleira C1', diasCriacao: 80 },
    { id: 'est-14', nome: 'Amortecedor Dianteiro',                categoria: 'Suspensão',     quantidade: 4,  minimo: 4,  preco: 220.0, localizacao: 'Prateleira C2', diasCriacao: 75 },
    { id: 'est-15', nome: 'Fluido de Freio DOT 4',                categoria: 'Fluidos',       quantidade: 15, minimo: 5,  preco: 25.0,  localizacao: 'Prateleira C3', diasCriacao: 75 },
    { id: 'est-16', nome: 'Capa de Volante Couro Sintético',      categoria: 'Volante',       quantidade: 8,  minimo: 3,  preco: 60.0,  localizacao: 'Prateleira D1', diasCriacao: 60 },
    { id: 'est-17', nome: 'Capa de Banco Universal',              categoria: 'Bancos',        quantidade: 6,  minimo: 2,  preco: 150.0, localizacao: 'Prateleira D2', diasCriacao: 60 },
    { id: 'est-18', nome: 'Tapete Automotivo Kit',                categoria: 'Acessórios',    quantidade: 10, minimo: 3,  preco: 90.0,  localizacao: 'Prateleira D3', diasCriacao: 55 },
    { id: 'est-19', nome: 'Kit Reparo Para-choque',               categoria: 'Funilaria',     quantidade: 7,  minimo: 3,  preco: 70.0,  localizacao: 'Prateleira E1', diasCriacao: 50 },
    { id: 'est-20', nome: 'Retrovisor Externo',                   categoria: 'Funilaria',     quantidade: 3,  minimo: 2,  preco: 130.0, localizacao: 'Prateleira E1', diasCriacao: 45 },
    { id: 'est-21', nome: 'Farol Dianteiro',                      categoria: 'Funilaria',     quantidade: 2,  minimo: 2,  preco: 340.0, localizacao: 'Prateleira E1', diasCriacao: 40 },
  ];

  return base.map(({ diasCriacao, ...item }) => {
    if (item.id === 'est-20') {
      return {
        ...item,
        status: 'quarentena' as const,
        quarentena: { motivo: 'Retrovisor não trava — defeito de fábrica', fornecedor: 'AutoPeças Beta Ltda', dataEntrada: diasAtras(18) },
        createdAt: diasAtras(diasCriacao),
      };
    }
    if (item.id === 'est-21') {
      return {
        ...item,
        status: 'quarentena' as const,
        quarentena: { motivo: 'Lente trincada no recebimento', fornecedor: 'Distribuidora Central', dataEntrada: diasAtras(5) },
        createdAt: diasAtras(diasCriacao),
      };
    }
    return { ...item, status: 'ativo' as const, createdAt: diasAtras(diasCriacao) };
  });
}

export function buildSeedKits(): EstoqueKit[] {
  return [
    {
      id: 'kit-1',
      nome: 'Kit Revisão Básica Fiat Uno',
      descricao: 'Óleo, filtro de óleo e filtro de ar pra revisão básica.',
      itens: [
        { itemId: 'est-5', quantidade: 4 },
        { itemId: 'est-7', quantidade: 1 },
        { itemId: 'est-8', quantidade: 1 },
      ],
      servicoId: '6', // Revisão Geral Preventiva
      createdAt: diasAtras(70),
    },
    {
      id: 'kit-2',
      nome: 'Kit Troca de Óleo Completa',
      descricao: 'Óleo do motor + filtro de óleo.',
      itens: [
        { itemId: 'est-5', quantidade: 4 },
        { itemId: 'est-7', quantidade: 1 },
      ],
      servicoId: '1', // Troca de Óleo e Filtro
      createdAt: diasAtras(65),
    },
    {
      id: 'kit-3',
      nome: 'Kit Freio Dianteiro Gol',
      descricao: 'Pastilha e disco dianteiros.',
      itens: [
        { itemId: 'est-12', quantidade: 2 },
        { itemId: 'est-13', quantidade: 2 },
      ],
      servicoId: '2', // Revisão do Sistema de Freio
      createdAt: diasAtras(50),
    },
    {
      id: 'kit-4',
      nome: 'Kit Suspensão Dianteira',
      descricao: 'Par de amortecedores dianteiros.',
      itens: [{ itemId: 'est-14', quantidade: 2 }],
      servicoId: '3', // Alinhamento 3D + Balanceamento
      createdAt: diasAtras(40),
    },
  ];
}

export function buildSeedMovimentos(): MovimentoEstoque[] {
  const iniciais: MovimentoEstoque[] = buildSeedEstoque().map((item, i) => ({
    id: `mov-inicial-${i}`,
    itemId: item.id,
    tipo: 'entrada',
    quantidade: item.quantidade,
    motivo: 'Cadastro inicial',
    criadoEm: item.createdAt,
  }));

  const saidas: Array<[string, number, string, number]> = [
    ['est-5', 4, 'Kit: Kit Troca de Óleo Completa', 3],
    ['est-7', 1, 'Kit: Kit Troca de Óleo Completa', 3],
    ['est-5', 4, 'Kit: Kit Revisão Básica Fiat Uno', 6],
    ['est-7', 1, 'Kit: Kit Revisão Básica Fiat Uno', 6],
    ['est-8', 1, 'Kit: Kit Revisão Básica Fiat Uno', 6],
    ['est-12', 2, 'Kit: Kit Freio Dianteiro Gol', 9],
    ['est-13', 2, 'Kit: Kit Freio Dianteiro Gol', 9],
    ['est-10', 6, 'Saída manual — revisão elétrica avulsa', 12],
    ['est-5', 4, 'Kit: Kit Troca de Óleo Completa', 15],
    ['est-7', 1, 'Kit: Kit Troca de Óleo Completa', 15],
    ['est-14', 2, 'Kit: Kit Suspensão Dianteira', 18],
    ['est-12', 3, 'Saída manual — reposição avulsa', 22],
    ['est-5', 4, 'Kit: Kit Revisão Básica Fiat Uno', 26],
    ['est-7', 1, 'Kit: Kit Revisão Básica Fiat Uno', 26],
    ['est-8', 1, 'Kit: Kit Revisão Básica Fiat Uno', 26],
    ['est-9', 2, 'Saída manual — reposição avulsa', 33],
  ];

  const movSaida: MovimentoEstoque[] = saidas.map(([itemId, quantidade, motivo, dias], i) => ({
    id: `mov-saida-${i}`,
    itemId,
    tipo: 'saida',
    quantidade,
    motivo,
    criadoEm: diasAtras(dias),
  }));

  return [...iniciais, ...movSaida];
}

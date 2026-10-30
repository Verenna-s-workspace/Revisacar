// ── Estoque: utilitários ──────────────────────────────

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

  const ordenado: ItemEstoqueMovimentado[] = Array.from(contagem.entries())
    .map(([itemId, quantidade]) => {
      const item = itensPorId.get(itemId)!;
      return {
        nome: item.nome,
        categoria: item.categoria,
        quantidade,
        percentual: total > 0 ? (quantidade / total) * 100 : 0,
        id: item.id,
        preco: item.preco,
        quantidadeAtual: item.quantidade,
        fotoDataUrl: item.fotoDataUrl,
      };
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

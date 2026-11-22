import { CATEGORIA_GRUPOS, CATEGORIAS_FLAT } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';

export interface GrupoCategoria {
  grupo: string;
  opcoes: { categoria: string; qtd: number }[];
}

/**
 * Categorias do sistema, agrupadas, com quantos itens cada uma tem — mais um grupo "Outras"
 * com qualquer categoria antiga que ainda exista nos itens. Alimenta o filtro de categoria
 * (popover no desktop, folha de filtros no celular).
 */
export function agruparCategorias(itens: EstoqueItem[]): GrupoCategoria[] {
  const contagem = new Map<string, number>();
  itens.forEach(i => contagem.set(i.categoria, (contagem.get(i.categoria) ?? 0) + 1));

  const grupos: GrupoCategoria[] = CATEGORIA_GRUPOS.map(g => ({
    grupo: g.grupo,
    opcoes: g.categorias.map(c => ({ categoria: c, qtd: contagem.get(c) ?? 0 })),
  }));
  const outras = [...contagem.keys()]
    .filter(c => !CATEGORIAS_FLAT.includes(c))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (outras.length > 0) {
    grupos.push({ grupo: 'Outras', opcoes: outras.map(c => ({ categoria: c, qtd: contagem.get(c) ?? 0 })) });
  }
  return grupos;
}

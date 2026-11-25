// Precisa bater exatamente com CATEGORIAS_ENTRADA / CATEGORIAS_SAIDA em
// backend/orders/serializers.py — se adicionar uma categoria lá, adiciona
// o label aqui também.

export const LABEL_CATEGORIA_ENTRADA: Record<string, string> = {
  servicos: 'Serviços',
  pecas: 'Venda de Peças',
  acessorios: 'Acessórios',
  outros: 'Outros',
};

export const LABEL_CATEGORIA_SAIDA: Record<string, string> = {
  aluguel: 'Aluguel',
  energia: 'Energia',
  agua: 'Água',
  internet: 'Internet',
  salarios: 'Salários',
  contabilidade: 'Contabilidade',
  compra_pecas: 'Compra de Peças',
  ferramentas: 'Ferramentas',
  equipamentos: 'Equipamentos',
  manutencao: 'Manutenção',
  impostos: 'Impostos',
  marketing: 'Marketing',
  taxas: 'Taxas',
  outros: 'Outros',
};

export function labelCategoria(tipo: 'entrada' | 'saida', categoria: string): string {
  const mapa = tipo === 'entrada' ? LABEL_CATEGORIA_ENTRADA : LABEL_CATEGORIA_SAIDA;
  return mapa[categoria] ?? categoria;
}

export const LABEL_FORMA_PAGAMENTO: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
};

export const LABEL_STATUS: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

// Paleta pro donut de categorias — deriva das cores que o app já usa em vez
// de inventar um arco-íris novo.
export const PALETA_DONUT = [
  '#CC1400', // ferrari
  '#B35C00', // warn
  '#A01000', // ferrari-dark
  '#6B6760', // muted
  '#740C00', // ferrari-deep
  '#1A7F4B', // ok (só se sobrar categoria)
];

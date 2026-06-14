/** Format value as BRL currency */
export const formatBRL = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Heatmap days header labels */
export const HEAT_DAYS = ['Seg', 'Ter', 'Qua', 'Qux', 'Sáb', 'Dom'];

/** Service name → price mapping */
export const SVC_PRECO: Record<string, number> = {
  'Troca de Óleo': 180, 'Freios': 320, 'Suspensão': 450,
  'Alinhamento': 150, 'Ar Condicionado': 280,
};

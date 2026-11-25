/** Format value as BRL currency */
export const formatBRL = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BRL_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1,
});

/**
 * Valor em reais para rótulos com espaço curto (ex.: topo das barras do gráfico).
 * Até R$ 99.999,99 mostra o valor inteiro; acima disso abrevia ("R$ 1,2 mi"),
 * senão o número ultrapassa a largura da barra e é cortado pela borda do card.
 */
export const formatBRLCompacto = (v: number) =>
  Math.abs(v) >= 100_000 ? BRL_COMPACTO.format(v).replace(/\s/g, ' ') : formatBRL(v);

/** Rótulos do mapa de calor — 7 colunas, segunda a domingo (mesma ordem de `semana` da API). */
export const HEAT_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/**
 * Iniciais dos dias (mesma ordem de HEAT_DAYS) usadas no cabeçalho do mapa de
 * calor: com 18px por coluna, "Seg/Ter/Qua…" ficavam colados uns nos outros.
 * O nome completo continua disponível em HEAT_DAYS (tooltip / leitor de tela).
 */
export const HEAT_DAYS_INICIAIS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Nome completo de cada dia do mapa de calor (tooltip e acessibilidade). */
export const HEAT_DAYS_COMPLETO = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo',
];

/** Service name → price mapping */
export const SVC_PRECO: Record<string, number> = {
  'Troca de Óleo': 180, 'Freios': 320, 'Suspensão': 450,
  'Alinhamento': 150, 'Ar Condicionado': 280,
};

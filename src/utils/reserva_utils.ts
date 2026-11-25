// Reserva de caixa: a oficina separa um percentual de cada entrada paga num caixa de emergência.
// Não é desconto — o cliente paga o mesmo valor; é só uma separação interna do que entrou.
// Manter ESCOPOS_RESERVA em sincronia com ESCOPOS_RESERVA em backend/orders/serializers.py.

export type EscopoReserva = 'servicos' | 'pecas' | 'ambos';

export const ESCOPOS_RESERVA: { valor: EscopoReserva; titulo: string; descricao: string; exemplo: string }[] = [
  { valor: 'servicos', titulo: 'Só serviços', descricao: 'Mão de obra e serviços pagos', exemplo: 'serviço' },
  { valor: 'pecas', titulo: 'Só peças', descricao: 'Peças vendidas e pagas', exemplo: 'venda de peças' },
  { valor: 'ambos', titulo: 'Serviços e peças', descricao: 'Os dois tipos de entrada', exemplo: 'serviço com peças' },
];

export const LABEL_ESCOPO: Record<EscopoReserva, string> = {
  servicos: 'serviços',
  pecas: 'peças',
  ambos: 'serviços e peças',
};

export const LABEL_CATEGORIA_RESERVA: Record<string, string> = {
  servicos: 'Serviços',
  pecas: 'Peças',
};

/** Quanto vai para a reserva (só para a prévia na tela — o valor de verdade é calculado no servidor). */
export function calcularReserva(base: number, percentual: number): number {
  return Math.round(base * percentual) / 100;
}

/** Percentual digitado (só dígitos) → número de 1 a 100, ou null se não vale. */
export function lerPercentual(texto: string): number | null {
  if (!/^\d{1,3}$/.test(texto)) return null;
  const n = Number(texto);
  return n >= 1 && n <= 100 ? n : null;
}

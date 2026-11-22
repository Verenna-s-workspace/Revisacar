/** Quantidade pode ser fracionada (ex.: 1,5 L) — no padrão pt-BR, sem zeros sobrando. */
export function formatarQuantidade(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/** "2026-10-15" (ou ISO completo) → "15/10/2026". Lê a data como escrita, sem deslocar por fuso. */
export function formatarDataBR(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

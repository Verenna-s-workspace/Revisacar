/**
 * Extrai uma mensagem legível de um erro vindo de `api` (o corpo da resposta chega como texto JSON).
 * O backend responde `{"detail": "..."}` ou `{"campo": "mensagem"}` (validação) — mostra a primeira.
 */
export function mensagemDeErro(e: unknown, padrao: string): string {
  const bruto = e instanceof Error ? e.message : '';
  try {
    const j = JSON.parse(bruto);
    if (typeof j?.detail === 'string') return j.detail;
    const primeiro = Object.values(j ?? {}).find((v): v is string => typeof v === 'string');
    if (primeiro) return primeiro;
  } catch { /* corpo não era JSON */ }
  return padrao;
}

// ── Download de arquivo gerado no servidor (PDF etc.) ─────────────────────────

/** Nome seguro para arquivo: só letras, números, "_" e "-". */
export const nomeSeguro = (texto: string): string => texto.replace(/[^\w-]+/g, '_');

/** Entrega o Blob ao navegador como download. */
export function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

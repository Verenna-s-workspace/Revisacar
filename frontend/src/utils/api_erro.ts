// ── Helpers de erro/payload compartilhados pelos hooks que falam com o backend ──

/**
 * O backend responde erro como JSON ({detail:"..."} ou {campo:["..."]}), mas o
 * api.ts joga o corpo cru como mensagem do Error. Aqui vira texto legível.
 */
export function mensagemDoErro(e: unknown, padrao: string): string {
  const bruto = e instanceof Error ? e.message : '';
  try {
    const dado = JSON.parse(bruto);
    const textos: string[] = [];
    const coletar = (v: unknown, campo?: string) => {
      if (typeof v === 'string') textos.push(campo && campo !== 'detail' ? `${campo}: ${v}` : v);
      else if (Array.isArray(v)) v.forEach(x => coletar(x, campo));
      else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => coletar(x, k));
    };
    coletar(dado);
    if (textos.length) return textos.join(' ');
  } catch {
    // corpo não era JSON (ex.: falha de rede) — cai no padrão
  }
  return padrao;
}

/** Chave presente com valor `undefined` = "limpar o campo": JSON.stringify
 *  descartaria a chave e o backend entenderia "não mexer", então vira null. */
export function limparOpcionais<T extends object>(patch: T, chaves: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(patch as Record<string, unknown>) };
  for (const k of chaves) {
    if (k in patch && (patch as Record<string, unknown>)[k as string] === undefined) out[k as string] = null;
  }
  return out;
}

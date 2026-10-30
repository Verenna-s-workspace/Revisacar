// ── Datas no calendário local ───────────────────────────────────────────────

/** "YYYY-MM-DD" no calendário LOCAL. `toISOString()` converte para UTC e, à
 *  noite no Brasil (depois das 21h), devolve o dia seguinte. */
export function isoLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function hojeLocal(): string {
  return isoLocal(new Date());
}

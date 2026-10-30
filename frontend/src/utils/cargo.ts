// ── Rótulo do cargo de quem está logado ───────────────────────────────────────

import type { AuthResult } from '../types';

export const CARGO_LABEL: Record<string, string> = {
  dono: 'Dono',
  gerente: 'Gerente',
  mecanico: 'Mecânico',
  atendente: 'Atendente',
};

/**
 * Cargo para exibir ("Dono", "Gerente", "Mecânico", "Atendente").
 * Sessões salvas antes do cargo existir não têm `cargo`: nesse caso vale o `tipo`
 * (conta de CNPJ = dono; login por PIN = funcionário). Sem nada, não inventa cargo.
 */
export function rotuloDoCargo(user: Pick<AuthResult, 'cargo' | 'tipo'> | null | undefined): string {
  const cargo = (user?.cargo ?? '').trim().toLowerCase();
  if (cargo) return CARGO_LABEL[cargo] ?? cargo.charAt(0).toUpperCase() + cargo.slice(1);
  if (user?.tipo === 'funcionario') return 'Funcionário';
  if (user?.tipo === 'dono') return 'Dono';
  return '';
}

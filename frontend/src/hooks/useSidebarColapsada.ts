import { useSyncExternalStore } from 'react';

// ── Estado compartilhado da sidebar (expandida / compacta) ───────────────────
//
// Cada página monta a SUA <Sidebar> (OrdensPage, EstoquePage...), então ao navegar
// o componente é desmontado e montado de novo. Por isso o estado vive aqui, fora
// do React: sobrevive à navegação e fica salvo no localStorage pra valer também
// depois de recarregar. Ao montar já nasce no estado certo (sem animação de entrada).

const CHAVE = 'rv_sidebar_colapsada';

function lerInicial(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false; // localStorage bloqueado: começa expandida
  }
}

let colapsada = lerInicial();
const ouvintes = new Set<() => void>();

function assinar(fn: () => void) {
  ouvintes.add(fn);
  return () => { ouvintes.delete(fn); };
}

function alternar() {
  colapsada = !colapsada;
  try {
    localStorage.setItem(CHAVE, colapsada ? '1' : '0');
  } catch {
    // sem persistência: vale só nesta sessão
  }
  ouvintes.forEach(fn => fn());
}

/** [colapsada, alternar]. Todas as instâncias (uma por página) ficam em sincronia. */
export function useSidebarColapsada(): [boolean, () => void] {
  const valor = useSyncExternalStore(assinar, () => colapsada, () => false);
  return [valor, alternar];
}

/**
 * Aparelho fraco ou pessoa que pediu menos movimento: a sidebar troca de modo
 * na hora, sem animar a largura (animar a largura refaz o layout da página
 * inteira a cada quadro — é o que trava em máquina simples).
 */
export function semAnimacaoDeLargura(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
}
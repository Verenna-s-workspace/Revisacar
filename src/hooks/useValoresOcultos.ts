import { useCallback, useSyncExternalStore } from 'react';

const CHAVE = 'valores_ocultos';

// Espelho em memória: usado só se o sessionStorage estiver indisponível.
let memoria = true;

function gravar(oculto: boolean): void {
  try {
    window.sessionStorage.setItem(CHAVE, String(oculto));
  } catch {
    /* sessionStorage bloqueado (modo privado restrito etc.): segue só em memória */
  }
}

function ler(): boolean {
  try {
    const salvo = window.sessionStorage.getItem(CHAVE);
    return salvo === null ? true : salvo === 'true'; // sem chave => oculto
  } catch {
    return memoria;
  }
}

// Este trecho roda UMA vez por carga completa da página (F5 / aba nova), nunca
// em navegação SPA. Regravar aqui faz o F5 voltar a "oculto", mesmo o
// sessionStorage sobrevivendo ao reload. Fechar a aba também zera (o
// sessionStorage morre com ela). Já navegar entre telas mantém o estado.
if (typeof window !== 'undefined') gravar(true);

// Store simples: todos os componentes que usam o hook ficam sincronizados.
const ouvintes = new Set<() => void>();

function assinar(callback: () => void): () => void {
  ouvintes.add(callback);
  return () => { ouvintes.delete(callback); };
}

function definir(oculto: boolean): void {
  memoria = oculto;
  gravar(oculto);
  ouvintes.forEach((l) => l());
}

export function useValoresOcultos(): { valoresOcultos: boolean; alternarValores: () => void } {
  const valoresOcultos = useSyncExternalStore(assinar, ler, () => true);
  const alternarValores = useCallback(() => definir(!ler()), []);
  return { valoresOcultos, alternarValores };
}

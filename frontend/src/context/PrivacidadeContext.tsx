import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useValoresOcultos } from '../hooks/useValoresOcultos';

// ── Modo Privacidade ─────────────────────────────────────────────────────────
// Liga/desliga a máscara dos valores financeiros da Visão Geral, do Financeiro
// e dos Relatórios. O estado vive no hook useValoresOcultos (sessionStorage,
// chave 'valores_ocultos'): começa SEMPRE oculto, mantém ao navegar entre telas
// e volta a ocultar ao recarregar (F5) ou fechar/reabrir a aba.

interface PrivacidadeCtx {
  /** true = valores financeiros mascarados. */
  oculto: boolean;
  alternar: () => void;
  /** true depois do 1º clique no botão — só então anunciamos a mudança pra leitor de tela. */
  interagiu: boolean;
}

// Sem Provider (ex.: componente usado fora do Dashboard) tudo continua visível.
const PADRAO: PrivacidadeCtx = { oculto: false, alternar: () => {}, interagiu: false };
const Contexto = createContext<PrivacidadeCtx>(PADRAO);

export function PrivacidadeProvider({ children }: { children: ReactNode }) {
  const { valoresOcultos, alternarValores } = useValoresOcultos();
  const [interagiu, setInteragiu] = useState(false);

  const alternar = useCallback(() => { setInteragiu(true); alternarValores(); }, [alternarValores]);
  const valor = useMemo(
    () => ({ oculto: valoresOcultos, alternar, interagiu }),
    [valoresOcultos, alternar, interagiu],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePrivacidade(): PrivacidadeCtx {
  return useContext(Contexto);
}

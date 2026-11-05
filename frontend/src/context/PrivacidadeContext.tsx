import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// ── Modo Privacidade ─────────────────────────────────────────────────────────
// Liga/desliga a máscara dos valores financeiros da Visão Geral, do Financeiro
// e dos Relatórios. O estado fica salvo neste aparelho (localStorage) pra não
// "desligar sozinho" a cada recarga — quem usa o sistema com cliente por perto
// quer isso sempre ligado. Se o storage estiver bloqueado, só vale na sessão.

const CHAVE = 'revisacar:privacidade-financeira';

function lerInicial(): boolean {
  try { return window.localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

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
  const [oculto, setOculto] = useState<boolean>(lerInicial);
  const [interagiu, setInteragiu] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(CHAVE, oculto ? '1' : '0'); } catch { /* storage bloqueado: segue só em memória */ }
  }, [oculto]);

  const alternar = useCallback(() => { setInteragiu(true); setOculto(v => !v); }, []);
  const valor = useMemo(() => ({ oculto, alternar, interagiu }), [oculto, alternar, interagiu]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePrivacidade(): PrivacidadeCtx {
  return useContext(Contexto);
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BuscaGlobal } from '../components/BuscaGlobal';
import type { ResultadoBusca } from '../types/busca';

// ── Busca global (⌘K / Ctrl+K) ───────────────────────────────────────────────
// O Provider fica no Dashboard, acima das telas: cada tela monta a própria top-bar, então o atalho e a
// paleta não podem morar nela. A top-bar só chama `abrir()`. Quem sabe ABRIR o resultado (trocar de
// tela e abrir o registro) é o Dashboard, que se registra com `useAoEscolherResultadoDaBusca`.

type AoEscolher = (r: ResultadoBusca) => void;

interface BuscaCtx {
  abrir: () => void;
  /** Registra quem trata o resultado escolhido; devolve a função que desfaz o registro. */
  registrar: (fn: AoEscolher) => () => void;
}

// Sem Provider (componente usado fora do Dashboard) a busca simplesmente não faz nada.
const PADRAO: BuscaCtx = { abrir: () => {}, registrar: () => () => {} };
const Contexto = createContext<BuscaCtx>(PADRAO);

const ehMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');

/** O que mostrar no atalho: ⌘K no Mac, Ctrl K nos demais sistemas (Windows e Linux). */
export const rotuloDoAtalho = () => (ehMac() ? '⌘K' : 'Ctrl K');

export function BuscaGlobalProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const tratador = useRef<AoEscolher | null>(null);

  const abrir = useCallback(() => setAberta(true), []);
  const fechar = useCallback(() => setAberta(false), []);
  const registrar = useCallback((fn: AoEscolher) => {
    tratador.current = fn;
    return () => { if (tratador.current === fn) tratador.current = null; };
  }, []);

  // Cmd+K no Mac, Ctrl+K no Windows/Linux (a tecla Windows/Super é do sistema e não chega à página).
  // preventDefault: no Firefox o Ctrl+K leva o foco à barra de busca do navegador.
  useEffect(() => {
    const mac = ehMac();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== 'k' || e.altKey || e.shiftKey) return;
      const combina = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
      if (!combina) return;
      e.preventDefault();
      setAberta(v => !v);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  const valor = useMemo(() => ({ abrir, registrar }), [abrir, registrar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberta && (
        <BuscaGlobal
          onFechar={fechar}
          onEscolher={r => { setAberta(false); tratador.current?.(r); }}
        />
      )}
    </Contexto.Provider>
  );
}

export const useBuscaGlobal = () => useContext(Contexto);

/** Quem abre o resultado escolhido. Sempre usa a versão mais recente de `fn` (sem recriar o registro). */
export function useAoEscolherResultadoDaBusca(fn: AoEscolher) {
  const { registrar } = useContext(Contexto);
  const ultima = useRef(fn);
  useEffect(() => { ultima.current = fn; });
  useEffect(() => registrar(r => ultima.current(r)), [registrar]);
}

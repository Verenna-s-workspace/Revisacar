import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { tokens } from '../constants';

// ── Notificações rápidas (toast) ──────────────────────────────────────────────
// Aviso curto que aparece sobre a tela e some sozinho. Serve para o que o usuário precisa saber
// na hora mas não merece um bloco fixo na página (ex.: ação indisponível, falha ao gerar um PDF).
//
//   const toast = useToast();
//   toast.erro('A OS precisa estar finalizada para gerar este documento.');
//
// O `ToastProvider` fica uma vez só, na raiz do painel (main.tsx). Sem ele, `useToast()` devolve
// funções que não fazem nada — um componente nunca quebra por falta de provider.

type Tom = 'erro' | 'ok' | 'info';

interface ToastItem {
  id: number;
  tom: Tom;
  texto: string;
}

export interface ToastApi {
  erro: (texto: string) => void;
  ok: (texto: string) => void;
  info: (texto: string) => void;
}

const SEM_PROVIDER: ToastApi = { erro: () => {}, ok: () => {}, info: () => {} };
const ToastContext = createContext<ToastApi>(SEM_PROVIDER);

export const useToast = (): ToastApi => useContext(ToastContext);

/** Quanto tempo cada tipo fica na tela. Erro fica mais: dá tempo de ler e entender. */
const DURACAO_MS: Record<Tom, number> = { erro: 6000, ok: 3500, info: 4500 };
/** Acima disso o mais antigo sai (clicar várias vezes não empilha a tela inteira). */
const MAX_VISIVEIS = 3;

const ESTILO_DO_TOM: Record<Tom, { cor: string; fundo: string; borda: string }> = {
  erro: { cor: tokens.color.crit, fundo: tokens.color.critBg, borda: tokens.color.critBorder },
  ok: { cor: tokens.color.ok, fundo: tokens.color.okBg, borda: tokens.color.okBorder },
  info: { cor: tokens.color.textSecond, fundo: tokens.color.surfaceHigh, borda: tokens.color.border },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ToastItem[]>([]);
  const atuais = useRef<ToastItem[]>([]);
  const proximoId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const gravar = useCallback((lista: ToastItem[]) => {
    atuais.current = lista;
    setItens(lista);
  }, []);

  const fechar = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    gravar(atuais.current.filter(i => i.id !== id));
  }, [gravar]);

  const mostrar = useCallback((tom: Tom, texto: string) => {
    // A mesma mensagem já está na tela: só reinicia o tempo dela, em vez de empilhar cópias.
    const repetida = atuais.current.find(i => i.tom === tom && i.texto === texto);
    if (repetida) {
      const antigo = timers.current.get(repetida.id);
      if (antigo) clearTimeout(antigo);
      timers.current.set(repetida.id, setTimeout(() => fechar(repetida.id), DURACAO_MS[tom]));
      return;
    }
    const id = proximoId.current++;
    let lista = [...atuais.current, { id, tom, texto }];
    while (lista.length > MAX_VISIVEIS) {
      const saiu = lista[0];
      const t = timers.current.get(saiu.id);
      if (t) clearTimeout(t);
      timers.current.delete(saiu.id);
      lista = lista.slice(1);
    }
    gravar(lista);
    timers.current.set(id, setTimeout(() => fechar(id), DURACAO_MS[tom]));
  }, [fechar, gravar]);

  useEffect(() => {
    const ativos = timers.current;
    return () => { ativos.forEach(t => clearTimeout(t)); ativos.clear(); };
  }, []);

  const api = useMemo<ToastApi>(() => ({
    erro: (t) => mostrar('erro', t),
    ok: (t) => mostrar('ok', t),
    info: (t) => mostrar('info', t),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--mobile-bottom-nav-h, 0px) + 16px)',
          zIndex: 'var(--z-toast, 10000)', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 8, padding: '0 16px', pointerEvents: 'none',
        }}
      >
        {itens.map(t => {
          const c = ESTILO_DO_TOM[t.tom];
          return (
            <div
              key={t.id}
              role={t.tom === 'erro' ? 'alert' : 'status'}
              style={{
                pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', maxWidth: 440,
                boxSizing: 'border-box', padding: '11px 12px 11px 14px', fontFamily: tokens.fontSans,
                fontSize: '0.86rem', lineHeight: 1.45, color: c.cor, background: c.fundo,
                border: `1px solid ${c.borda}`, borderLeft: `4px solid ${c.cor}`, borderRadius: tokens.radius.md,
                boxShadow: tokens.shadow.lg,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, wordBreak: 'break-word' }}>{t.texto}</span>
              <button
                type="button"
                onClick={() => fechar(t.id)}
                aria-label="Fechar aviso"
                style={{
                  background: 'transparent', border: 'none', color: c.cor, cursor: 'pointer', fontSize: '1.15rem',
                  lineHeight: 1, padding: '0 2px', opacity: 0.7,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

import { lazy, type ComponentType } from 'react';

/**
 * Telas baixadas só quando são abertas (code splitting).
 *
 * Antes o navegador baixava e interpretava o app inteiro (~1,3 MB de JS: todas as telas + gráficos)
 * antes de mostrar até a tela de login. Agora cada tela vira um arquivo à parte: o login sai rápido
 * e o resto vem em seguida. Depois que o painel aparece, `preCarregarQuandoOcioso` baixa as outras
 * telas em segundo plano, então trocar de tela continua instantâneo.
 *
 * Depois de um deploy, uma aba aberta antes pode pedir um arquivo que não existe mais (o nome muda a
 * cada build). Nesse caso a página recarrega UMA vez para pegar a versão nova.
 */

const CHAVE_RECARGA = 'revisacar:recarregou-por-tela';

function baixarComRecarga<T>(carregar: () => Promise<T>): Promise<T> {
  return carregar().then(
    (modulo) => {
      try { sessionStorage.removeItem(CHAVE_RECARGA); } catch { /* sem storage: segue */ }
      return modulo;
    },
    (erro) => {
      let jaRecarregou = true;
      try { jaRecarregou = sessionStorage.getItem(CHAVE_RECARGA) === '1'; } catch { /* sem storage */ }
      if (!jaRecarregou) {
        try { sessionStorage.setItem(CHAVE_RECARGA, '1'); } catch { /* sem storage */ }
        window.location.reload();
        return new Promise<T>(() => { /* a página vai recarregar */ });
      }
      throw erro;
    },
  );
}

/** lazy() de um export nomeado, com `preCarregar()` para baixar antes de abrir. */
export function telaSobDemanda<P>(carregar: () => Promise<ComponentType<P>>) {
  let promessa: Promise<ComponentType<P>> | null = null;
  const preCarregar = () => (promessa ??= carregar().catch((e) => {
    promessa = null;            // deixa tentar de novo na próxima vez
    throw e;
  }));
  // Só abrir a tela pode recarregar a página; a pré-carga em segundo plano que falhe fica quieta.
  const Tela = lazy(() => baixarComRecarga(preCarregar).then((Componente) => ({ default: Componente })));
  return Object.assign(Tela, { preCarregar });
}

/** Baixa as telas quando o navegador estiver livre (sem atrapalhar a tela atual). */
export function preCarregarQuandoOcioso(telas: Array<{ preCarregar: () => Promise<unknown> }>) {
  const rodar = () => telas.forEach((t) => t.preCarregar().catch(() => { /* tenta de novo ao abrir */ }));
  if ('requestIdleCallback' in window) window.requestIdleCallback(rodar, { timeout: 4000 });
  else setTimeout(rodar, 1500);
}

import { useEffect, useRef } from 'react';
import { DURACAO_DESTAQUE_MS } from '../utils/destaque';
import type { Destaque } from '../utils/destaque';

/**
 * Ao chegar numa tela vinda de um card da Visão Geral: rola até o(s)
 * elemento(s) alvo e aplica a classe `.destaque-aura` (pulsação lenta, ver
 * dashboard.css) por ~4 s; depois remove e chama `aoConcluir`.
 *
 * `pronto` = o conteúdo da tela já existe (dados carregados). Mexe só na classe
 * do DOM — não re-renderiza nada e funciona em componentes memoizados.
 * Alvos que não existirem (ex.: Lucro sem permissão) são simplesmente ignorados.
 */
export function useDestaqueAoChegar(destaque: Destaque | null | undefined, pronto: boolean, aoConcluir?: () => void) {
  const aoConcluirRef = useRef(aoConcluir);
  aoConcluirRef.current = aoConcluir;

  useEffect(() => {
    if (!destaque || !pronto) return;

    let timer: number | undefined;
    let raf2: number | undefined;
    let elementos: HTMLElement[] = [];

    // 2 frames: espera o layout assentar (e o scroll-to-top da troca de tela) antes de medir/rolar.
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        elementos = destaque.alvos
          .map(id => document.querySelector<HTMLElement>(`[data-destaque-id="${id}"]`))
          .filter((el): el is HTMLElement => !!el);

        if (elementos.length === 0) { aoConcluirRef.current?.(); return; }

        const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        elementos[0].scrollIntoView({
          behavior: reduzirMovimento ? 'auto' : 'smooth',
          // Mais de um alvo: alinha o 1º no topo pra o outro ter chance de aparecer junto.
          block: elementos.length > 1 ? 'start' : 'center',
        });
        elementos.forEach(el => el.classList.add('destaque-aura'));

        timer = window.setTimeout(() => {
          elementos.forEach(el => el.classList.remove('destaque-aura'));
          aoConcluirRef.current?.();
        }, DURACAO_DESTAQUE_MS);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== undefined) cancelAnimationFrame(raf2);
      if (timer !== undefined) window.clearTimeout(timer);
      elementos.forEach(el => el.classList.remove('destaque-aura'));
    };
  }, [destaque, pronto]);
}

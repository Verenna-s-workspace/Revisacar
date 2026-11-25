import { useEffect, useRef } from 'react';
import './ignicao.css';
import { LOGO_SRC, NOME_MARCA, ROTULO_ACESSIVEL } from './ignicaoConfig';
import { criarLinha } from './linhaDoTempo';
import type { PropsVarianteIgnicao } from './tiposIgnicao';

const FADE = 400;
const SEGURA = 1600;

/**
 * prefers-reduced-motion: sem estrelas, sem expansão, sem decodificação e sem som.
 * Só um fade curto (~0,4 s) com logo, nome e frase sobre o vermelho; depois, o dashboard.
 */
export function IgnicaoReduzida({ frase, onConcluir }: PropsVarianteIgnicao) {
  const aoConcluir = useRef(onConcluir);
  aoConcluir.current = onConcluir;
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    let concluido = false;
    let desmontado = false;
    const montadoEm = performance.now();
    const concluir = () => {
      if (concluido || desmontado) return;
      concluido = true;
      aoConcluir.current();
    };

    let anim: Animation;
    try {
      anim = criarLinha(raiz, [
        [0, { opacity: 0 }, 'ease-out'],
        [FADE, { opacity: 1 }, 'linear'],
        [FADE + SEGURA, { opacity: 1 }, 'ease-in'],
        [FADE + SEGURA + FADE, { opacity: 0 }],
      ]);
      anim.finished.then(concluir, () => undefined);
    } catch {
      concluir();
      return;
    }
    const seguranca = window.setTimeout(concluir, FADE * 2 + SEGURA + 1500);

    const pular = () => {
      if (concluido || desmontado || performance.now() - montadoEm < 350) return;
      const atual = getComputedStyle(raiz).opacity;
      anim.cancel();
      const fade = raiz.animate([{ opacity: atual }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      fade.finished.then(concluir, () => undefined);
    };
    raiz.addEventListener('pointerdown', pular);

    return () => {
      desmontado = true;
      window.clearTimeout(seguranca);
      raiz.removeEventListener('pointerdown', pular);
      try {
        anim.cancel();
      } catch {
        /* já cancelada */
      }
    };
  }, []);

  return (
    <div ref={raizRef} className="ig-raiz ig-raiz--reduzida" role="status" aria-label={ROTULO_ACESSIVEL}>
      <div className="ig-cena">
        <div className="ig-bloco">
          <div className="ig-linha">
            <span className="ig-logo-caixa">
              <img className="ig-logo" src={LOGO_SRC} alt="" />
            </span>
            <span className="ig-nome">{NOME_MARCA}</span>
          </div>
          <p className="ig-frase">{frase}</p>
        </div>
      </div>
    </div>
  );
}

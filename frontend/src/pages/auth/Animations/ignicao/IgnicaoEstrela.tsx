import { useEffect, useMemo, useRef } from 'react';
import './ignicao.css';
import { criarAudioIgnicao } from './ignicaoAudio';
import {
  COR_FUNDO,
  DECODE_FPS,
  curvaExpansao,
  ESTRELA_ASPECTO,
  ESTRELA_PATH,
  ESTRELA_VIEWBOX,
  LOGO_SRC,
  NOME_MARCA,
  PLANO_DECODE,
  ROTULO_ACESSIVEL,
  T,
  escalaCobertura,
  larguraEstrelaCentral,
} from './ignicaoConfig';
import { gerarEstrelas } from './estrelas';
import { SpriteGlifos, TOTAL_GLIFOS, idGlifo } from './glifosMecanicos';
import { agora, criarLinha, iniciarJuntas } from './linhaDoTempo';
import type { Passo } from './linhaDoTempo';
import type { Modo } from './decodificacao';
import type { PropsVarianteIgnicao } from './tiposIgnicao';

const PASSOS_EXPANSAO = 16;
const EASE_POP = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_ASSENTA = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // leve ultrapassagem, como uma peça que encaixa
const IGNORAR_TOQUE_ATE = 350; // ms: evita que o toque do "Continuar" pule a animação sem querer
const PLANO = PLANO_DECODE;
const N = NOME_MARCA.length;

/** Próximo símbolo de mecânica: nunca repete o anterior nem o que outra letra está mostrando agora. */
function proximoSimbolo(atual: number, emUso: number[]): number {
  let s = atual;
  let tentativas = 0;
  while ((s === atual || emUso.includes(s)) && tentativas++ < 20) s = Math.floor(Math.random() * TOTAL_GLIFOS);
  return s;
}

/** Variante "ignição": estrela vermelha, estrelas pipocando, expansão e RevisaCar decodificado. */
export function IgnicaoEstrela({ frase, onConcluir }: PropsVarianteIgnicao) {
  const aoConcluir = useRef(onConcluir);
  aoConcluir.current = onConcluir;

  const raizRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const centralRef = useRef<SVGSVGElement>(null);
  const preenchimentoRef = useRef<HTMLDivElement>(null);
  const profundidadeRef = useRef<HTMLDivElement>(null);
  const blocoRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const ecoRef = useRef<HTMLSpanElement>(null);
  const nomeRef = useRef<HTMLSpanElement>(null);
  const fraseRef = useRef<HTMLParagraphElement>(null);
  const estrelaRefs = useRef<(SVGSVGElement | null)[]>([]);
  const vivaRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const txtRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const usoRefs = useRef<(SVGUseElement | null)[]>([]);

  const estrelas = useMemo(() => gerarEstrelas(window.innerWidth, window.innerHeight), []);

  useEffect(() => {
    const raiz = raizRef.current;
    const halo = haloRef.current;
    const central = centralRef.current;
    const preenchimento = preenchimentoRef.current;
    const profundidade = profundidadeRef.current;
    const bloco = blocoRef.current;
    const logo = logoRef.current;
    const eco = ecoRef.current;
    const nome = nomeRef.current;
    const fraseEl = fraseRef.current;
    if (!raiz || !halo || !central || !preenchimento || !profundidade || !bloco || !logo || !eco || !nome || !fraseEl) return;

    let concluido = false;
    let desmontado = false;
    let raf = 0;
    let seguranca = 0;
    const montadoEm = performance.now();
    const anims: Animation[] = [];
    const audio = criarAudioIgnicao();

    const concluir = () => {
      if (concluido || desmontado) return;
      concluido = true;
      raiz.classList.remove('is-moving'); // will-change só durante a animação
      aoConcluir.current();
    };

    let saida: Animation;
    let t0 = 0;

    try {
      if (typeof raiz.animate !== 'function') throw new Error('Web Animations indisponível');

      // Sem ler layout (getBoundingClientRect forçaria um layout síncrono no meio do setup): a largura da
      // estrela central é uma função da viewport, a mesma fórmula do CSS (--ig-w).
      const larg = window.innerWidth;
      const alt = window.innerHeight;
      const S = escalaCobertura(larg, alt, larguraEstrelaCentral(Math.min(larg, alt)));
      const escala = (k: number) => `scale(${k})`;

      // Estrela central: surge de repente, assenta e depois cresce até cobrir a viewport.
      anims.push(
        criarLinha(central, [
          [0, { opacity: 0, transform: escala(0.45) }, 'linear'],
          [T.plim, { opacity: 0, transform: escala(0.45) }, 'linear'],
          [T.plim + 16, { opacity: 1, transform: escala(0.5) }, EASE_POP],
          [T.plim + 300, { opacity: 1, transform: escala(1.12) }, 'ease-in-out'],
          [T.plim + 520, { opacity: 1, transform: escala(1) }, 'linear'],
          // Expansão: a escala cresce de forma exponencial (S^progresso), seguindo a curva que acelera no
          // meio e suaviza no fim. Assim o tamanho aparente cresce de modo contínuo até o fim, sem um
          // trecho final em que a tela já está toda vermelha e nada se move.
          [T.expIni, { opacity: 1, transform: escala(1) }, 'linear'],
          ...Array.from({ length: PASSOS_EXPANSAO }, (_, k): Passo => {
            const u = (k + 1) / PASSOS_EXPANSAO;
            return [
              Math.round(T.expIni + u * (T.expFim - T.expIni)),
              { opacity: 1, transform: escala(Math.pow(S, curvaExpansao(u))) },
              'linear',
            ];
          }),
        ]),
      );

      // Brilho suave atrás da estrela (gradiente estático; só a opacidade anima).
      anims.push(
        criarLinha(halo, [
          [0, { opacity: 0 }, 'linear'],
          [T.plim, { opacity: 0 }, 'ease-out'],
          [T.plim + 600, { opacity: 0.9 }, 'linear'],
          [T.expIni, { opacity: 0.9 }, 'ease-in'],
          [T.expIni + 800, { opacity: 0 }],
        ]),
      );

      // Estrelas pequenas: "pipocam" uma a uma e somem, engolidas pela estrela central em expansão.
      estrelas.forEach((e, i) => {
        const el = estrelaRefs.current[i];
        if (!el) return;
        const oculta = { opacity: 0, transform: 'scale(0) rotate(-35deg)' };
        const assentada = { opacity: 1, transform: 'scale(1) rotate(0deg)' };
        const sai = Math.max(e.sai, e.atraso + 560);
        anims.push(
          criarLinha(el, [
            [0, oculta, 'linear'],
            [e.atraso, oculta, EASE_POP],
            [e.atraso + 260, { opacity: 1, transform: 'scale(1.3) rotate(0deg)' }, 'ease-in-out'],
            [e.atraso + 520, assentada, 'linear'],
            [sai, assentada, 'ease-in'],
            [sai + 380, { opacity: 0, transform: 'scale(0.35) rotate(25deg)' }],
          ]),
        );
      });

      // Camada vermelha sólida: fecha qualquer canto que a estrela ainda não tenha coberto.
      anims.push(
        criarLinha(preenchimento, [
          [0, { opacity: 0 }, 'linear'],
          [T.fillIni, { opacity: 0 }, 'linear'],
          [T.expFim, { opacity: 1 }],
        ]),
      );

      // Profundidade: escurece de leve as bordas depois do preenchimento (gradiente estático).
      anims.push(
        criarLinha(profundidade, [
          [0, { opacity: 0 }, 'linear'],
          [T.expFim, { opacity: 0 }, 'ease-out'],
          [T.logoFim + 300, { opacity: 1 }],
        ]),
      );

      // Revelação, parte 1: a logo sobe e encaixa (leve ultrapassagem) e um anel de eco se abre.
      anims.push(
        criarLinha(logo, [
          [0, { opacity: 0 }, 'linear'],
          [T.logoIni, { opacity: 0 }, 'ease-out'],
          [T.logoIni + Math.round((T.logoFim - T.logoIni) * 0.45), { opacity: 1 }],
          [T.logoFim, { opacity: 1 }],
        ]),
        criarLinha(logo, [
          [0, { transform: 'translateY(0.16em) scale(0.8)' }, 'linear'],
          [T.logoIni, { transform: 'translateY(0.16em) scale(0.8)' }, EASE_ASSENTA],
          [T.logoFim, { transform: 'translateY(0) scale(1)' }],
        ]),
        criarLinha(eco, [
          [0, { opacity: 0, transform: 'scale(0.7)' }, 'linear'],
          [T.logoFim - 120, { opacity: 0, transform: 'scale(0.7)' }, 'linear'],
          [T.logoFim - 119, { opacity: 0.55, transform: 'scale(0.7)' }, EASE_POP],
          [T.logoFim + 900, { opacity: 0, transform: 'scale(2.3)' }],
        ]),
      );

      // Revelação, parte 2: nome (decodificação), frase (sobe e aparece) e um empurrão lento de câmera.
      anims.push(
        criarLinha(nome, [
          [0, { opacity: 0 }, 'linear'],
          [T.nomeIni, { opacity: 0 }, 'linear'],
          [T.nomeIni + 60, { opacity: 1 }],
        ]),
        criarLinha(fraseEl, [
          [0, { opacity: 0, transform: 'translateY(10px)' }, 'linear'],
          [T.fraseIni, { opacity: 0, transform: 'translateY(10px)' }, EASE_POP],
          [T.fraseFim, { opacity: 1, transform: 'translateY(0)' }],
        ]),
        criarLinha(bloco, [
          [0, { transform: 'scale(1)' }, 'linear'],
          [T.logoIni, { transform: 'scale(1)' }, 'linear'],
          [T.fim, { transform: 'scale(1.045)' }],
        ]),
      );

      // Saída: fade-out da tela vermelha, revelando o dashboard que já está por baixo.
      saida = criarLinha(raiz, [
        [0, { opacity: 1 }, 'linear'],
        [T.saidaIni, { opacity: 1 }, 'ease-in-out'],
        [T.fim, { opacity: 0 }],
      ]);
      anims.push(saida);

      t0 = iniciarJuntas(anims);
      saida.finished.then(concluir, () => undefined);
      seguranca = window.setTimeout(concluir, T.fim + 1500); // rede de segurança: nunca prender o usuário
    } catch {
      concluir(); // sem Web Animations (ou erro): entra direto, sem animação
      return;
    }

    // Decodificação do nome e sons: mesmo relógio das animações, sem layout (só texto e atributos).
    const letras = txtRefs.current.map((el) => {
      const no = document.createTextNode('');
      el?.appendChild(no);
      return no;
    });
    const modos: Modo[] = NOME_MARCA.split('').map(() => 'v');
    const simbolos: number[] = NOME_MARCA.split('').map(() => -1);
    let ultimoTick = -Infinity;
    let plimTocado = false;
    let subTocado = false;
    let saltou = false;
    let proxPop = 0;

    const assentar = (i: number) => {
      const el = vivaRefs.current[i];
      if (!el || typeof el.animate !== 'function') return;
      const destaque = i === PLANO.destaque;
      anims.push(
        el.animate([{ transform: `scale(${destaque ? 1.34 : 1.14})` }, { transform: 'scale(1)' }], {
          duration: destaque ? 360 : 210,
          easing: EASE_ASSENTA,
        }),
      );
    };

    const saltar = () => {
      const el = vivaRefs.current[PLANO.pivo];
      audio?.salto();
      if (!el || typeof el.animate !== 'function') return;
      // A barra sobe, se endireita no ápice (onde vira a letra) e pousa com um pequeno achatamento.
      anims.push(
        el.animate(
          [
            { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 0, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
            { transform: 'translateY(-0.55em) rotate(20deg) scale(1)', offset: 0.5, easing: 'cubic-bezier(0.32, 0, 0.67, 0)' },
            { transform: 'translateY(0) rotate(0deg) scale(1.12, 0.88)', offset: 0.88, easing: 'ease-out' },
            { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 1 },
          ],
          { duration: PLANO.saltoDur },
        ),
      );
    };

    const decodificar = (td: number, trocar: boolean) => {
      const emUso = simbolos.filter((s, i) => s >= 0 && modos[i] === 's');
      for (let i = 0; i < N; i++) {
        const m = PLANO.modo(i, td);
        const viva = vivaRefs.current[i];
        if (m !== modos[i]) {
          modos[i] = m;
          if (viva) viva.dataset.m = m;
          if (m === 'b') letras[i].data = '\\';
          if (m === 'l') {
            letras[i].data = NOME_MARCA[i];
            audio?.tique(i);
            if (i !== PLANO.pivo) assentar(i);
          }
          if (m === 's') {
            simbolos[i] = proximoSimbolo(-1, emUso);
            usoRefs.current[i]?.setAttribute('href', `#${idGlifo(simbolos[i])}`);
            emUso.push(simbolos[i]);
          }
        } else if (m === 's' && trocar) {
          const novo = proximoSimbolo(simbolos[i], emUso);
          simbolos[i] = novo;
          usoRefs.current[i]?.setAttribute('href', `#${idGlifo(novo)}`);
          emUso.push(novo);
        }
      }
      if (!saltou && td >= PLANO.saltoIni) {
        saltou = true;
        saltar();
      }
    };

    const quadro = () => {
      const t = agora(t0);

      if (!plimTocado && t >= T.plim) {
        plimTocado = true;
        audio?.plim();
      }
      while (proxPop < estrelas.length && t >= estrelas[proxPop].atraso) {
        audio?.pop(proxPop);
        proxPop++;
      }
      if (!subTocado && t >= T.expIni) {
        subTocado = true;
        audio?.subBass(T.expFim - T.expIni);
      }

      if (t >= T.nomeIni) {
        const trocar = t - ultimoTick >= 1000 / DECODE_FPS; // por tempo, não a cada frame
        if (trocar) ultimoTick = t;
        decodificar(t - T.nomeIni, trocar);
      }

      if (t < T.nomeFim + 160) raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);

    // Um toque na tela (sem botão visível) encerra a animação; Esc também, para teclado.
    const pular = () => {
      if (concluido || desmontado || performance.now() - montadoEm < IGNORAR_TOQUE_ATE) return;
      cancelAnimationFrame(raf);
      audio?.silenciar();
      const opacidadeAtual = getComputedStyle(raiz).opacity;
      saida.cancel();
      const fade = raiz.animate([{ opacity: opacidadeAtual }, { opacity: 0 }], {
        duration: 220,
        easing: 'ease-out',
        fill: 'forwards',
      });
      anims.push(fade);
      fade.finished.then(concluir, () => undefined);
    };
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') pular();
    };
    raiz.addEventListener('pointerdown', pular);
    window.addEventListener('keydown', aoTeclar);

    return () => {
      desmontado = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(seguranca);
      raiz.removeEventListener('pointerdown', pular);
      window.removeEventListener('keydown', aoTeclar);
      anims.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* já cancelada */
        }
      });
      letras.forEach((no) => no.remove());
      audio?.encerrar();
    };
  }, [estrelas]);

  return (
    <div
      ref={raizRef}
      className="ig-raiz is-moving"
      role="status"
      aria-label={ROTULO_ACESSIVEL}
      style={{ backgroundColor: COR_FUNDO }}
    >
      <SpriteGlifos />
      <div ref={haloRef} className="ig-halo" aria-hidden="true" />

      {estrelas.map((e, i) => (
        <svg
          key={i}
          ref={(el: SVGSVGElement | null) => {
            estrelaRefs.current[i] = el;
          }}
          className="ig-estrela"
          viewBox={ESTRELA_VIEWBOX}
          aria-hidden="true"
          style={{
            left: `${e.x}%`,
            top: `${e.y}%`,
            width: e.tam,
            height: e.tam * ESTRELA_ASPECTO,
            marginLeft: -e.tam / 2,
            marginTop: (-e.tam * ESTRELA_ASPECTO) / 2,
          }}
        >
          <path d={ESTRELA_PATH} />
        </svg>
      ))}

      <svg ref={centralRef} className="ig-central" viewBox={ESTRELA_VIEWBOX} aria-hidden="true">
        <path d={ESTRELA_PATH} />
      </svg>

      <div ref={preenchimentoRef} className="ig-preenchimento" aria-hidden="true" />
      <div ref={profundidadeRef} className="ig-profundidade" aria-hidden="true" />

      <div className="ig-cena">
        <div ref={blocoRef} className="ig-bloco">
          <div className="ig-linha">
            <span className="ig-logo-caixa">
              <span ref={ecoRef} className="ig-eco" aria-hidden="true" />
              <img ref={logoRef} className="ig-logo" src={LOGO_SRC} alt="" decoding="async" />
            </span>
            <span ref={nomeRef} className="ig-nome" aria-hidden="true">
              {NOME_MARCA.split('').map((letra, i) => (
                <span key={i} className="ig-letra">
                  <span className="ig-fantasma">{letra}</span>
                  <span
                    className="ig-viva"
                    data-m="v"
                    ref={(el: HTMLSpanElement | null) => {
                      vivaRefs.current[i] = el;
                    }}
                  >
                    <span
                      className="ig-txt"
                      ref={(el: HTMLSpanElement | null) => {
                        txtRefs.current[i] = el;
                      }}
                    />
                    <svg className="ig-glifo" viewBox="0 0 24 24" aria-hidden="true">
                      <use
                        href={`#${idGlifo(0)}`}
                        ref={(el: SVGUseElement | null) => {
                          usoRefs.current[i] = el;
                        }}
                      />
                    </svg>
                  </span>
                </span>
              ))}
            </span>
            <span className="ig-sr">{NOME_MARCA}</span>
          </div>
          <p ref={fraseRef} className="ig-frase">
            {frase}
          </p>
        </div>
      </div>
    </div>
  );
}

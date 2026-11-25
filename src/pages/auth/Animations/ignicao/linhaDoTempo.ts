/**
 * Linha do tempo única: todas as animações visuais são Web Animations (só transform e opacity,
 * executadas no compositor) criadas com o mesmo startTime em document.timeline. A decodificação do
 * texto e os sons usam esse mesmo relógio, então nada sai de sincronia.
 */

export type Passo = [ms: number, props: Keyframe, easing?: string];

/** Cria uma animação com keyframes em milissegundos absolutos (o 1º passo deve estar em 0). */
export function criarLinha(el: Element, passos: Passo[]): Animation {
  const duracao = passos[passos.length - 1][0];
  const quadros: Keyframe[] = passos.map(([ms, props, easing]) => ({
    ...props,
    offset: ms / duracao,
    ...(easing ? { easing } : {}),
  }));
  return el.animate(quadros, { duration: duracao, fill: 'both' });
}

/** Alinha todas as animações no mesmo instante da timeline do documento e devolve esse instante. */
export function iniciarJuntas(animacoes: Animation[]): number {
  const t0 = document.timeline.currentTime as number;
  animacoes.forEach((a) => {
    a.startTime = t0;
  });
  return t0;
}

export function agora(t0: number): number {
  return (document.timeline.currentTime as number) - t0;
}

/** Curva cubic-bezier(x1, y1, x2, y2) como função (mesma definição do CSS): tempo 0..1 -> progresso 0..1. */
export function curvaBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const coef = (a: number, b: number) => ({ c: 3 * a, b: 3 * (b - a) - 3 * a, a: 1 - 3 * a - (3 * (b - a) - 3 * a) });
  const cx = coef(x1, x2);
  const cy = coef(y1, y2);
  const eixo = (k: { a: number; b: number; c: number }, s: number) => ((k.a * s + k.b) * s + k.c) * s;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let s = t;
    for (let i = 0; i < 24; i++) {
      const x = eixo(cx, s);
      if (Math.abs(x - t) < 1e-5) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return eixo(cy, s);
  };
}

/** Inversa da curva: dado o progresso 0..1, devolve o tempo 0..1 em que ele é atingido. */
export function tempoNaCurva(curva: (t: number) => number, progresso: number): number {
  if (progresso <= 0) return 0;
  if (progresso >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const meio = (lo + hi) / 2;
    if (curva(meio) < progresso) lo = meio;
    else hi = meio;
  }
  return (lo + hi) / 2;
}

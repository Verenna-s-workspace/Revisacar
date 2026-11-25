/**
 * Áudio da animação de ignição, sintetizado com Web Audio (nenhum arquivo de som).
 * Sem controle na tela: volume baixo e fixo, seguindo o volume do aparelho.
 * Qualquer falha (sem suporte, bloqueio de autoplay) faz a animação seguir muda, sem erro visível.
 */

export interface IgnicaoAudio {
  /** "plim" de cristal: agudo, curto e sutil (fase 1). */
  plim(): void;
  /** "pop" suave com leve variação de tom entre uma estrela e outra (fase 2). */
  pop(indice: number): void;
  /** Sub-bass suave de preenchimento (fase 3). */
  subBass(duracaoMs: number): void;
  /** Clique mecânico curto e baixo, quando uma letra do nome fixa (fase 4). */
  tique(indice: number): void;
  /** Saltinho agudo, quando a barra invertida salta e vira letra (fase 4). */
  salto(): void;
  /** Corta o som rapidamente (usado ao pular). */
  silenciar(): void;
  /** Libera os nós de áudio ao desmontar. */
  encerrar(): void;
}

const VOLUME_MESTRE = 0.5;
// Pentatônica maior em torno de C5: o pop nunca soa desafinado, mesmo variando.
const NOTAS_POP = [523.25, 587.33, 659.25, 783.99, 880.0, 987.77];

let contextoComum: AudioContext | null = null;

function novoContexto(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

function retomar(ctx: AudioContext): void {
  try {
    const promessa = ctx.resume() as Promise<void> | undefined;
    if (promessa && typeof promessa.catch === 'function') promessa.catch(() => undefined);
  } catch {
    /* sem áudio */
  }
}

/**
 * Chamar DENTRO do clique em "Continuar" da etapa 2 (gesto do usuário): cria e destrava o
 * AudioContext para passar pela política de autoplay (inclusive no iOS, com um buffer mudo).
 */
export function prepararAudioIgnicao(): void {
  try {
    if (!contextoComum || contextoComum.state === 'closed') contextoComum = novoContexto();
    const ctx = contextoComum;
    if (!ctx) return;
    retomar(ctx);
    const fonte = ctx.createBufferSource();
    fonte.buffer = ctx.createBuffer(1, 1, 22050);
    fonte.connect(ctx.destination);
    fonte.start(0);
  } catch {
    /* sem áudio */
  }
}

interface Parcial {
  tipo?: OscillatorType;
  f0: number;
  f1?: number; // frequência final (glissando exponencial)
  tGliss?: number; // duração do glissando, em s
  pico: number;
  ataque: number; // s
  decaimento: number; // s
}

function tocarParcial(ctx: AudioContext, destino: AudioNode, quando: number, p: Parcial): void {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = p.tipo ?? 'sine';
  osc.frequency.setValueAtTime(p.f0, quando);
  if (p.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(p.f1, quando + (p.tGliss ?? p.ataque + p.decaimento));
  ganho.gain.setValueAtTime(0.0001, quando);
  ganho.gain.exponentialRampToValueAtTime(p.pico, quando + p.ataque);
  ganho.gain.exponentialRampToValueAtTime(0.0001, quando + p.ataque + p.decaimento);
  osc.connect(ganho);
  ganho.connect(destino);
  osc.start(quando);
  osc.stop(quando + p.ataque + p.decaimento + 0.05);
  osc.onended = () => {
    try {
      osc.disconnect();
      ganho.disconnect();
    } catch {
      /* já desconectado */
    }
  };
}

export function criarAudioIgnicao(): IgnicaoAudio | null {
  try {
    if (!contextoComum || contextoComum.state === 'closed') contextoComum = novoContexto();
    const ctx = contextoComum;
    if (!ctx) return null;
    retomar(ctx);

    const mestre = ctx.createGain();
    mestre.gain.value = VOLUME_MESTRE;
    const compressor = ctx.createDynamicsCompressor();
    mestre.connect(compressor);
    compressor.connect(ctx.destination);

    let ativo = true;
    // Se o navegador bloqueou o áudio (contexto não está "running"), os sons são simplesmente ignorados.
    const podeTocar = () => ativo && ctx.state === 'running';
    const seguro = (fn: () => void) => {
      try {
        if (podeTocar()) fn();
      } catch {
        /* sem áudio */
      }
    };

    return {
      plim: () =>
        seguro(() => {
          const t = ctx.currentTime + 0.005;
          // Parciais inarmônicos, como vidro/cristal batido.
          tocarParcial(ctx, mestre, t, { f0: 1760, pico: 0.14, ataque: 0.003, decaimento: 0.55 });
          tocarParcial(ctx, mestre, t, { f0: 3520 * 1.005, pico: 0.05, ataque: 0.003, decaimento: 0.38 });
          tocarParcial(ctx, mestre, t, { f0: 5300, pico: 0.022, ataque: 0.002, decaimento: 0.24 });
        }),
      pop: (indice) =>
        seguro(() => {
          const t = ctx.currentTime + 0.003;
          const nota = NOTAS_POP[(indice * 2 + Math.floor(Math.random() * 3)) % NOTAS_POP.length];
          const f = nota * (1 + (Math.random() - 0.5) * 0.03);
          tocarParcial(ctx, mestre, t, { f0: f * 1.5, f1: f, tGliss: 0.05, pico: 0.1, ataque: 0.004, decaimento: 0.13 });
        }),
      subBass: (duracaoMs) =>
        seguro(() => {
          const t = ctx.currentTime + 0.01;
          const d = duracaoMs / 1000;
          // Fundamental grave + 2º harmônico, para ser audível também em alto-falante de celular.
          tocarParcial(ctx, mestre, t, { f0: 46, f1: 58, tGliss: d, pico: 0.3, ataque: d * 0.7, decaimento: d * 0.5 });
          tocarParcial(ctx, mestre, t, { f0: 92, f1: 116, tGliss: d, pico: 0.08, ataque: d * 0.7, decaimento: d * 0.5 });
        }),
      tique: (indice) =>
        seguro(() => {
          const t = ctx.currentTime + 0.002;
          // Dois parciais curtíssimos, como uma peça metálica encaixando; o tom sobe um pouco a cada letra.
          const base = 1500 * (1 + indice * 0.035);
          tocarParcial(ctx, mestre, t, { tipo: 'triangle', f0: base, f1: base * 0.72, tGliss: 0.03, pico: 0.05, ataque: 0.001, decaimento: 0.035 });
          tocarParcial(ctx, mestre, t, { f0: base * 2.7, pico: 0.014, ataque: 0.001, decaimento: 0.02 });
        }),
      salto: () =>
        seguro(() => {
          const t = ctx.currentTime + 0.002;
          tocarParcial(ctx, mestre, t, { f0: 520, f1: 980, tGliss: 0.16, pico: 0.07, ataque: 0.006, decaimento: 0.2 });
        }),
      silenciar: () => {
        ativo = false;
        try {
          mestre.gain.cancelScheduledValues(ctx.currentTime);
          mestre.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        } catch {
          /* sem áudio */
        }
      },
      encerrar: () => {
        ativo = false;
        try {
          mestre.gain.cancelScheduledValues(ctx.currentTime);
          mestre.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        } catch {
          /* sem áudio */
        }
        window.setTimeout(() => {
          try {
            mestre.disconnect();
            compressor.disconnect();
            const p = ctx.suspend() as Promise<void> | undefined;
            if (p && typeof p.catch === 'function') p.catch(() => undefined);
          } catch {
            /* sem áudio */
          }
        }, 300);
      },
    };
  } catch {
    return null;
  }
}

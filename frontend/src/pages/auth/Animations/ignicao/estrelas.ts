import { ESTRELA_RAIO_INSCRITO, T, curvaExpansao, escalaCobertura, larguraEstrelaCentral } from './ignicaoConfig';
import { tempoNaCurva } from './linhaDoTempo';

export interface EstrelaPop {
  x: number; // % da largura
  y: number; // % da altura
  tam: number; // largura em px
  atraso: number; // ms em que a estrela "pipoca"
  sai: number; // ms em que a estrela começa a sumir, engolida pela estrela central
}

const MARGEM = 0.07; // fração da largura/altura sem estrelas, perto das bordas

/**
 * Sorteia de 14 a 22 estrelas pequenas (todas brancas) espalhadas de forma uniforme:
 *  1. a tela vira uma grade de células com mais que o dobro de células que estrelas;
 *  2. células perto da estrela central ficam de fora;
 *  3. as estrelas ocupam as células pelo método do "ponto mais distante" (cada nova estrela vai
 *     para a célula mais afastada de todas as já escolhidas), o que evita blocos e vazios;
 *  4. cada estrela recebe um desvio aleatório dentro da própria célula, para não parecer grade.
 * A ordem do pop segue a mesma escolha: estrelas consecutivas aparecem longe uma da outra, então a
 * tela "pipoca" por inteiro em vez de varrer de um lado ao outro.
 */
export function gerarEstrelas(largura: number, altura: number, rnd: () => number = Math.random): EstrelaPop[] {
  const alvo = 14 + Math.floor(rnd() * 9); // 14..22
  const menor = Math.min(largura, altura);
  const raioLivre = larguraEstrelaCentral(menor) * 0.85;

  const x0 = largura * MARGEM;
  const y0 = altura * MARGEM;
  const larguraUtil = largura * (1 - 2 * MARGEM);
  const alturaUtil = altura * (1 - 2 * MARGEM);

  // Monta a grade; se, depois de reservar o centro, sobrarem menos células que estrelas, aumenta a folga.
  let folga = 2.6;
  let celulas: { cx: number; cy: number }[] = [];
  let cw = 0;
  let ch = 0;
  do {
    const lado = Math.sqrt((larguraUtil * alturaUtil) / (alvo * folga));
    const colunas = Math.max(2, Math.round(larguraUtil / lado));
    const linhas = Math.max(2, Math.round(alturaUtil / lado));
    cw = larguraUtil / colunas;
    ch = alturaUtil / linhas;
    celulas = [];
    for (let c = 0; c < colunas; c++) {
      for (let l = 0; l < linhas; l++) {
        const cx = x0 + (c + 0.5) * cw;
        const cy = y0 + (l + 0.5) * ch;
        if (Math.hypot(cx - largura / 2, cy - altura / 2) > raioLivre + Math.min(cw, ch) * 0.45) celulas.push({ cx, cy });
      }
    }
    folga += 0.3;
  } while (celulas.length < alvo && folga < 6);

  const n = Math.min(alvo, celulas.length);
  const escolhidas: { cx: number; cy: number }[] = [];
  const restantes = celulas.slice();
  // primeira estrela: célula aleatória; as seguintes: a mais distante das já escolhidas
  escolhidas.push(restantes.splice(Math.floor(rnd() * restantes.length), 1)[0]);
  while (escolhidas.length < n && restantes.length) {
    let melhor = 0;
    let melhorDist = -1;
    restantes.forEach((cel, i) => {
      const d =
        Math.min(...escolhidas.map((o) => Math.hypot(cel.cx - o.cx, cel.cy - o.cy))) +
        rnd() * Math.min(cw, ch) * 0.12;
      if (d > melhorDist) {
        melhorDist = d;
        melhor = i;
      }
    });
    escolhidas.push(restantes.splice(melhor, 1)[0]);
  }

  // Intervalos irregulares entre os pops, normalizados para preencher a janela da fase 2.
  const folgas = Array.from({ length: Math.max(0, n - 1) }, () => 0.4 + rnd() * 1.2);
  const soma = folgas.reduce((a, b) => a + b, 0) || 1;
  const janela = T.popUltimo - T.popIni;
  const atrasos: number[] = [T.popIni];
  folgas.forEach((f) => atrasos.push(atrasos[atrasos.length - 1] + (f / soma) * janela));

  // A estrela central cresce de forma exponencial (escala = S^progresso); a estrela pequena começa a
  // sumir um pouco antes de ser alcançada, para estar apagada quando a central passar por cima.
  const larguraCentral = larguraEstrelaCentral(menor);
  const S = escalaCobertura(largura, altura, larguraCentral);
  const duracaoFade = 380;
  return escolhidas.map((cel, i) => {
    const px = cel.cx + (rnd() - 0.5) * cw * 0.5;
    const py = cel.cy + (rnd() - 0.5) * ch * 0.5;
    const tam = Math.round(Math.max(10, Math.min(44, menor * (0.026 + rnd() * 0.05))));
    const distancia = Math.hypot(px - largura / 2, py - altura / 2);
    const escalaNecessaria = distancia / (ESTRELA_RAIO_INSCRITO * (larguraCentral / 2));
    const progresso = escalaNecessaria <= 1 ? 0 : Math.min(1, Math.log(escalaNecessaria) / Math.log(S));
    const alcancadaEm = T.expIni + (T.expFim - T.expIni) * tempoNaCurva(curvaExpansao, progresso);
    const sai = Math.round(Math.max(T.expIni - 150, alcancadaEm - duracaoFade * 0.7));
    return { x: (px / largura) * 100, y: (py / altura) * 100, tam, atraso: Math.round(atrasos[i]), sai };
  });
}

/**
 * Plano da decodificação do nome, no estilo "barra empurrada":
 *
 *   R\  →  Re\  →  Rev\  →  (a barra salta e vira o "i")  →  s a C a r
 *
 * Cada letra nova surge no lugar da barra invertida (embaralhando símbolos de mecânica por um
 * instante) e a barra é empurrada um espaço para a direita. Ao chegar na posição do pivô, a barra
 * salta, se endireita e vira a letra daquela posição; as letras restantes fecham em cascata.
 * Com `pivo` = última posição, a barra caminha a palavra inteira e salta para a última letra.
 *
 * É um módulo puro (sem DOM): recebe tempos em ms relativos ao início da decodificação.
 */

export type Modo = 'v' | 'b' | 's' | 'l'; // vazio | barra | símbolo embaralhando | letra final

export interface PlanoDecodificacao {
  nome: string;
  pivo: number;
  /** Duração total (ms), até a última letra assentar. */
  total: number;
  /** Instante em que cada posição começa a embaralhar símbolos (Infinity no pivô). */
  inicioSimbolo: number[];
  /** Instante em que cada posição vira a letra final. */
  fixaEm: number[];
  /** Salto da barra no pivô. */
  saltoIni: number;
  saltoDur: number;
  /** Instante, no ápice do salto, em que a barra vira a letra do pivô. */
  trocaEm: number;
  /** Índice da letra de fechamento com destaque (a última maiúscula depois do início). */
  destaque: number;
  /** Modo de cada posição no instante `td`. */
  modo(indice: number, td: number): Modo;
}

/** Parâmetros em ms (antes da escala de tempo). */
const P = {
  primeiraLetra: 200, // R: embaralha e fixa
  inicioPassos: 120, // 1ª letra empurrando a barra
  passo: 290, // intervalo entre as letras que empurram a barra
  duracaoSimbolo: 190, // quanto cada letra embaralha antes de fixar
  pausaAntesSalto: 230, // respiro depois da última letra antes do pivô
  duracaoSalto: 440,
  atrasoCascata: 70, // depois da troca no ápice
  passoCascata: 105,
  assentar: 280, // tempo para a última letra assentar
} as const;

export function planoDecodificacao(nome: string, pivoPedido: number, escala = 1): PlanoDecodificacao {
  const n = nome.length;
  const pivo = Math.max(1, Math.min(n - 1, pivoPedido));
  const e = (v: number) => Math.round(v * escala);

  const inicioSimbolo: number[] = new Array(n).fill(Infinity);
  const fixaEm: number[] = new Array(n).fill(Infinity);

  // Letra 0 e letras que empurram a barra (1 .. pivo-1)
  inicioSimbolo[0] = 0;
  fixaEm[0] = e(P.primeiraLetra);
  for (let k = 1; k < pivo; k++) {
    inicioSimbolo[k] = e(P.inicioPassos + k * P.passo);
    fixaEm[k] = inicioSimbolo[k] + e(P.duracaoSimbolo);
  }

  // Salto da barra no pivô
  const ultimaAntes = fixaEm[pivo - 1];
  const saltoIni = ultimaAntes + e(P.pausaAntesSalto);
  const saltoDur = e(P.duracaoSalto);
  const trocaEm = saltoIni + Math.round(saltoDur * 0.5);
  fixaEm[pivo] = trocaEm;

  // Cascata final (letras depois do pivô)
  for (let j = pivo + 1; j < n; j++) {
    inicioSimbolo[j] = trocaEm + e(P.atrasoCascata) + (j - pivo - 1) * e(P.passoCascata);
    fixaEm[j] = inicioSimbolo[j] + e(P.duracaoSimbolo);
  }

  const ultimaFixa = Math.max(...fixaEm.filter((v) => Number.isFinite(v)), saltoIni + saltoDur);
  const total = Math.max(ultimaFixa + e(P.assentar), saltoIni + saltoDur + e(P.assentar));

  // A barra fica na posição k de barraIni[k] até começar a embaralhar a letra k (ou, no pivô, a trocar).
  const barraIni: number[] = new Array(n).fill(Infinity);
  barraIni[1] = 0;
  for (let k = 2; k <= pivo; k++) barraIni[k] = inicioSimbolo[k - 1];

  // Última maiúscula (fora a inicial): é a letra de "fechamento" que ganha destaque (o C de RevisaCar).
  let destaque = -1;
  for (let i = 1; i < n; i++) if (nome[i] !== nome[i].toLowerCase()) destaque = i;
  if (destaque < 0) destaque = n - 1;

  const modo = (i: number, td: number): Modo => {
    if (td >= fixaEm[i]) return 'l';
    if (i === pivo) return td >= barraIni[i] ? 'b' : 'v';
    if (td >= inicioSimbolo[i]) return 's';
    if (i >= 1 && i < pivo && td >= barraIni[i]) return 'b';
    return 'v';
  };

  return { nome, pivo, total, inicioSimbolo, fixaEm, saltoIni, saltoDur, trocaEm, destaque, modo };
}

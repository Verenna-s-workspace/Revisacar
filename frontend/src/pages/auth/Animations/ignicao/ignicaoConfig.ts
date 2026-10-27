import { planoDecodificacao } from './decodificacao';
import { curvaBezier } from './linhaDoTempo';

/**
 * Configuração da animação de ignição (etapa 3 do cadastro: "Seja bem-vindo ao Revisacar").
 * Todos os tempos em milissegundos, contados do início da animação.
 */

export const COR_VERMELHO = '#D64C48'; // vermelho do SVG enviado (Estrela.svg)
export const COR_FUNDO = '#191512'; // cor média do background.jpg (aparece enquanto a imagem carrega)
export const FUNDO_SRC = '/ignicao/background.jpg';
export const LOGO_SRC = '/Logorevisavermelha.svg'; // a mesma do painel de auth
export const NOME_MARCA = 'RevisaCar';
export const FRASE_PADRAO = 'Luz onde antes havia dúvida.';
export const ROTULO_ACESSIVEL = 'Seja bem-vindo ao Revisacar';

/**
 * Velocidade geral: multiplica TODOS os tempos (1 = ritmo atual, ~9 s no total; a versão anterior
 * durava 5,6 s). Para deixar mais rápida, use 0.85; para mais lenta, 1.15.
 */
export const ESCALA_TEMPO = 1;

/**
 * Onde a barra invertida salta e vira a letra: posição 3 de "Rev\isacar" (o "i"). Use
 * NOME_MARCA.length - 1 para a barra caminhar a palavra inteira e saltar na última letra.
 */
export const PIVO_BARRA = 3;

export const PLANO_DECODE = planoDecodificacao(NOME_MARCA, PIVO_BARRA, ESCALA_TEMPO);

const e = (ms: number) => Math.round(ms * ESCALA_TEMPO);

const nomeIni = e(4850);
const nomeFim = nomeIni + PLANO_DECODE.total;
const fraseIni = nomeFim - e(150);
const fraseFim = fraseIni + e(650);
const saidaIni = fraseFim + e(1000); // a frase fica legível por ~1 s antes do fade-out

export const T = {
  plim: e(450), // fase 1: a estrela vermelha surge de repente
  popIni: e(1000), // fase 2: primeira estrela pequena
  popUltimo: e(2450), // início da última estrela pequena (o pop dura ~0,5 s)
  expIni: e(2950), // fase 3: expansão
  expFim: e(4500),
  fillIni: e(3900), // camada vermelha sólida começa a entrar em fade (fecha qualquer canto)
  logoIni: e(4500), // fase 4: revelação
  logoFim: e(5200),
  nomeIni, // decodificação de RevisaCar (a duração vem do plano)
  nomeFim,
  fraseIni,
  fraseFim,
  saidaIni, // fase 5: fade-out da tela vermelha
  fim: saidaIni + e(650),
} as const;

/** Curva da expansão da estrela central: acelera no meio e suaviza no fim (progresso do crescimento). */
export const EASE_EXPANSAO_PONTOS = [0.65, 0, 0.35, 1] as const;
export const curvaExpansao = curvaBezier(...EASE_EXPANSAO_PONTOS);

/** Decodificação: os símbolos trocam a no máximo 30 fps (por tempo, não a cada frame). */
export const DECODE_FPS = 30;

/**
 * Estrela de 4 pontas: mesmos pontos do Estrela.svg enviado, já com as transformações dos grupos
 * aplicadas (coordenadas finais). viewBox ajustado de 500x521 para 500x520.2 só para centralizar a
 * estrela exatamente (a geometria é idêntica).
 */
export const ESTRELA_PATH =
  'M250.00,-0.00C250.00,63.00 265.59,138.60 316.18,191.24C366.77,243.87 439.45,260.08 500.00,260.08C439.45,260.08 366.77,276.30 316.18,328.93C265.59,381.56 250.00,457.17 250.00,520.16C250.00,457.17 234.41,381.56 183.82,328.93C133.23,276.30 60.55,260.08 0.00,260.08C60.55,260.08 133.23,243.87 183.82,191.24C234.41,138.60 250.00,63.00 250.00,-0.00Z';
export const ESTRELA_VIEWBOX = '0 0 500 520.2';
export const ESTRELA_ASPECTO = 520.2 / 500; // altura / largura

/**
 * Raio do maior círculo que cabe dentro da estrela, em fração do semi-eixo horizontal (250).
 * Calculado sobre a curva do SVG (pior caso, a 45°). Usado para garantir que a estrela, ao crescer,
 * cubra os cantos da viewport — a estrela tem lados côncavos e precisa crescer muito além da diagonal.
 */
export const ESTRELA_RAIO_INSCRITO = 0.3807;
export const MARGEM_COBERTURA = 1.05;

/** Largura da estrela central: espelha o clamp(150px, 32vmin, 280px) do CSS (--ig-w). */
export function larguraEstrelaCentral(menorLado: number): number {
  return Math.min(280, Math.max(150, 0.32 * menorLado));
}

/** Fator de escala para a estrela central cobrir 100% da viewport (pelo círculo inscrito). */
export function escalaCobertura(largura: number, altura: number, larguraEstrela: number): number {
  const meiaDiagonal = Math.hypot(largura, altura) / 2;
  return (meiaDiagonal / (ESTRELA_RAIO_INSCRITO * (larguraEstrela / 2))) * MARGEM_COBERTURA;
}

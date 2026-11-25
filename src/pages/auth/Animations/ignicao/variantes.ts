import type { ComponentType } from 'react';
import { IgnicaoEstrela } from './IgnicaoEstrela';
import type { PropsVarianteIgnicao } from './tiposIgnicao';

export interface VarianteIgnicao {
  id: string;
  Componente: ComponentType<PropsVarianteIgnicao>;
}

/**
 * Lista de variantes de animação. Hoje tem uma só; para criar outra, basta adicionar uma entrada
 * aqui — o sorteio abaixo já está pronto e evita repetir a última exibida neste aparelho.
 */
export const VARIANTES: VarianteIgnicao[] = [{ id: 'estrela-ignicao', Componente: IgnicaoEstrela }];

const CHAVE_ULTIMA = 'revisacar:ignicao:ultima';

function lerUltima(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_ULTIMA);
  } catch {
    return null; // localStorage bloqueado/indisponível: segue sem a informação
  }
}

/** Sorteia uma variante, evitando a última exibida neste aparelho quando houver mais de uma. */
export function sortearVariante(lista: VarianteIgnicao[] = VARIANTES, rnd: () => number = Math.random): VarianteIgnicao {
  const ultima = lerUltima();
  const candidatas = lista.length > 1 ? lista.filter((v) => v.id !== ultima) : lista;
  return candidatas[Math.floor(rnd() * candidatas.length)] ?? lista[0];
}

/** Guarda qual variante foi exibida por último (não é flag de "já viu": só serve ao sorteio). */
export function registrarVarianteExibida(id: string): void {
  try {
    window.localStorage.setItem(CHAVE_ULTIMA, id);
  } catch {
    /* sem localStorage: sem problema */
  }
}

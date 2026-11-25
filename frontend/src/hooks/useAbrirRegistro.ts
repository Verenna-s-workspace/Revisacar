import { useEffect, useRef } from 'react';
import type { AbrirRegistro, TipoResultadoBusca } from '../types/busca';

/**
 * Atende o pedido "abra este registro" que a busca global deixa no Dashboard (`abrirRegistro`).
 * A tela de destino espera a PRÓPRIA lista carregar (`pronto`), acha o item pelo id e o abre do jeito
 * que já abre ao clicar numa linha (o `abrir` costuma ser o setSelected/setSel da tela).
 *
 * O pedido é consumido assim que a lista está pronta, achando o item ou não (registro excluído desde a
 * busca): assim ele nunca fica pendente para uma visita posterior à tela.
 */
export function useAbrirRegistro<T>({ pedido, tipo, pronto, itens, idDe, abrir, consumido }: {
  pedido: AbrirRegistro | null | undefined;
  tipo: TipoResultadoBusca;
  pronto: boolean;
  itens: T[];
  idDe: (item: T) => string;
  abrir: (item: T) => void;
  consumido?: () => void;
}) {
  // Funções da tela mudam a cada render; o efeito só deve reagir ao pedido e à lista.
  const ultimas = useRef({ idDe, abrir, consumido });
  useEffect(() => { ultimas.current = { idDe, abrir, consumido }; });

  useEffect(() => {
    if (!pedido || pedido.tipo !== tipo || !pronto) return;
    const { idDe: id, abrir: abre, consumido: fim } = ultimas.current;
    const achado = itens.find(item => id(item) === pedido.id);
    if (achado) abre(achado);
    fim?.();
  }, [pedido, tipo, pronto, itens]);
}

import { useEffect, useState } from 'react';
import { FRASE_PADRAO } from './ignicaoConfig';
import { IgnicaoReduzida } from './IgnicaoReduzida';
import { registrarVarianteExibida, sortearVariante } from './variantes';

function prefereMovimentoReduzido(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface Props {
  /** Chamada uma única vez ao fim da animação (ou ao toque que a pula). */
  onConcluir: () => void;
  frase?: string;
}

/**
 * Etapa 3 do cadastro: animação de boas-vindas em tela cheia, sem nenhum controle na tela.
 * Não usa flag de "já viu": quem decide quando tocar é o fluxo de cadastro (nunca o login).
 */
export function IgnicaoBoasVindas({ onConcluir, frase = FRASE_PADRAO }: Props) {
  const [reduzir] = useState(prefereMovimentoReduzido);
  const [variante] = useState(() => sortearVariante());

  useEffect(() => {
    registrarVarianteExibida(variante.id);
  }, [variante]);

  if (reduzir) return <IgnicaoReduzida frase={frase} onConcluir={onConcluir} />;
  const Variante = variante.Componente;
  return <Variante frase={frase} onConcluir={onConcluir} />;
}

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { nomeSugeridoParaTecnico } from '../utils/tecnico_sugerido';
import type { useOrdemServico } from './useOrdemServico';

/**
 * Preenche "Nome do técnico" com quem está logado, UMA vez por OS: na primeira vez que o passo de
 * encerramento abre. Depois disso o campo é do usuário (se ele apagar ou trocar, não voltamos a
 * preencher ao ir e voltar entre passos). Nunca sobrescreve um nome já digitado ou já salvo na OS.
 * A marca "já sugeriu" vive no hook da OS e é zerada ao começar ou abrir outra OS.
 */
export function useTecnicoSugerido(os: Pick<ReturnType<typeof useOrdemServico>, 'tecnico' | 'setTecnico' | 'tecnicoSugeridoRef'>) {
  const { user } = useAuth();
  const { tecnico, setTecnico, tecnicoSugeridoRef } = os;

  useEffect(() => {
    if (tecnicoSugeridoRef.current) return;
    tecnicoSugeridoRef.current = true;
    const sugestao = nomeSugeridoParaTecnico(user);
    if (!sugestao || tecnico.nome?.trim()) return;
    setTecnico((p) => (p.nome?.trim() ? p : { ...p, nome: sugestao }));
    // Só na montagem do passo: depende do estado inicial, não de cada tecla digitada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

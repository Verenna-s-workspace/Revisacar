import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import type { ReservaResumo } from '../features/Dashboard/Financeiro/types';

/**
 * Saldo e movimentos da reserva de caixa. É um extra do Financeiro: se a carga falhar (ou a oficina
 * nunca usou), o resto da tela segue normal. Se já havia dados, ficam os últimos conhecidos e `erro`
 * avisa que podem estar desatualizados — o saldo nunca some por causa de um tropeço de rede.
 */
export function useReserva({ podeVer }: { podeVer: boolean }) {
  const [reserva, setReserva] = useState<ReservaResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ultimaCarga = useRef(0);

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    const carga = ++ultimaCarga.current;
    try {
      const r = await api.obterReserva();
      if (carga !== ultimaCarga.current) return;
      setReserva(r);
      setErro(null);
    } catch (e) {
      if (carga !== ultimaCarga.current) return;
      setErro(mensagemDoErro(e, 'Não foi possível atualizar a reserva.'));
    }
  }, [podeVer]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // As ações propagam o erro (quem chama decide onde mostrá-lo) e, dando certo, recarregam.
  const retirar = useCallback(async (valor: number, descricao: string) => {
    await api.retirarDaReserva({ valor, descricao });
    await carregar();
  }, [carregar]);

  const desfazerRetirada = useCallback(async (id: string) => {
    await api.desfazerRetiradaDaReserva(id);
    await carregar();
  }, [carregar]);

  return { reserva, erro, recarregar: carregar, retirar, desfazerRetirada };
}

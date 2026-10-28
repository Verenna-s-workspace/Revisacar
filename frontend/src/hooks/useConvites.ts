import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDeErro } from '../utils/erros';
import type { Convite, NovoConviteInput } from '../types/convite';

/** Convites da oficina. Só carrega quando `ativo` (a tela abre o modal) para não pedir à toa. */
export function useConvites(ativo: boolean) {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await api.listarConvites();
      setConvites(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar os convites.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (ativo) load(); }, [ativo, load]);

  const criar = useCallback(async (input: NovoConviteInput): Promise<Convite> => {
    try {
      const novo: Convite = await api.criarConvite({ dias: input.dias, maxUsos: input.maxUsos ?? null });
      setConvites(prev => [novo, ...prev]);
      return novo;
    } catch (e) {
      throw new Error(mensagemDeErro(e, 'Não foi possível gerar o convite. Tente novamente.'));
    }
  }, []);

  const revogar = useCallback(async (id: string) => {
    try {
      await api.revogarConvite(id);
      setConvites(prev => prev.map(c => (c.id === id ? { ...c, ativo: false, revogadoEm: new Date().toISOString() } : c)));
    } catch (e) {
      throw new Error(mensagemDeErro(e, 'Não foi possível cancelar o convite. Tente novamente.'));
    }
  }, []);

  return { convites, loading, erro, reload: load, criar, revogar };
}

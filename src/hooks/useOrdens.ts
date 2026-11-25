import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import type { OrdemRow } from '../types/dashboard';

/**
 * Lista de ordens de serviço da oficina (GET /ordens) — usada pela tela
 * Ordens, pelas "Ordens recentes" da Visão Geral e pelos Clientes.
 * (Os números da Visão Geral NÃO saem daqui: vêm de useVisaoGeral.)
 */
export function useOrdens() {
  const [ordens, setOrdens] = useState<OrdemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista: OrdemRow[] = await api.listarOrdens();
      setOrdens(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setOrdens([]);
      setErro(mensagemDoErro(e, 'Não foi possível carregar as ordens de serviço.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { ordens, loading, erro, recarregar: carregar };
}

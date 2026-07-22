import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { buildSeedServicos } from '../utils/servicos_utils';
import type { NovoServicoInput, ServicoItem } from '../types/servico';

function makeId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface ServicoStats {
  total: number;
  ativos: number;
  categorias: number;
  precoMedio: number;
}

export function useServicos() {
  const [servicos, setServicos] = useState<ServicoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingApi, setUsingApi] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarServicos();
      const lista: ServicoItem[] = Array.isArray(data) ? data : data?.servicos ?? [];
      if (lista.length || Array.isArray(data)) {
        setServicos(lista);
        setUsingApi(true);
      } else {
        setServicos(buildSeedServicos());
        setUsingApi(false);
      }
    } catch {
      // Backend ainda não expõe /servicos — usa dados de demonstração.
      setServicos(buildSeedServicos());
      setUsingApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addServico = useCallback(async (input: NovoServicoInput) => {
    const novo: ServicoItem = {
      id: makeId(),
      nome: input.nome,
      categoria: input.categoria,
      preco: input.preco,
      duracao: input.duracao,
      descricao: input.descricao,
      ativo: input.ativo ?? true,
      createdAt: new Date().toISOString(),
    };

    setServicos(prev => [novo, ...prev]);

    if (usingApi) {
      try {
        await api.criarServico(input);
      } catch {
        // mantém o registro local mesmo se a chamada falhar
      }
    }
    return novo;
  }, [usingApi]);

  const updateServico = useCallback(async (id: string, patch: Partial<NovoServicoInput>) => {
    setServicos(prev => prev.map(s => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)));

    if (usingApi) {
      try {
        await api.atualizarServico(id, patch);
      } catch {
        // segue com o estado local
      }
    }
  }, [usingApi]);

  const deleteServico = useCallback(async (id: string) => {
    setServicos(prev => prev.filter(s => s.id !== id));

    if (usingApi) {
      try {
        await api.deletarServico(id);
      } catch {
        // já removido localmente
      }
    }
  }, [usingApi]);

  const toggleAtivo = useCallback(async (id: string) => {
    const atual = servicos.find(s => s.id === id);
    if (!atual) return;
    await updateServico(id, { ativo: !atual.ativo });
  }, [servicos, updateServico]);

  const stats: ServicoStats = useMemo(() => {
    const categoriasUnicas = new Set(servicos.map(s => s.categoria));
    const precoMedio = servicos.length
      ? servicos.reduce((soma, s) => soma + s.preco, 0) / servicos.length
      : 0;
    return {
      total: servicos.length,
      ativos: servicos.filter(s => s.ativo).length,
      categorias: categoriasUnicas.size,
      precoMedio,
    };
  }, [servicos]);

  return {
    servicos,
    loading,
    usingApi,
    stats,
    reload: load,
    addServico,
    updateServico,
    deleteServico,
    toggleAtivo,
  };
}

export type UseServicosReturn = ReturnType<typeof useServicos>;

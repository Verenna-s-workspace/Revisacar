import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
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
  const [erro, setErro] = useState<string | null>(null);

  // Mesmo padrão de useEstoque/useRelatorios: fallback pra dados de
  // demonstração só em desenvolvimento (import.meta.env.DEV). Em produção
  // mostra o erro real em vez de serviços fictícios. Uma resposta bem
  // sucedida (mesmo com lista vazia) nunca é substituída por demo, em
  // nenhum ambiente.
  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await api.listarServicos();
      const lista: ServicoItem[] = Array.isArray(data) ? data : data?.servicos ?? [];
      setServicos(lista);
      setUsingApi(true);
    } catch {
      if (import.meta.env.DEV) {
        setServicos(buildSeedServicos());
        setUsingApi(false);
      } else {
        setServicos([]);
        setUsingApi(false);
        setErro('Não foi possível carregar o catálogo de serviços.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Com a API no ar o servidor é a fonte da verdade: nada aparece na lista
  // antes dele confirmar, e o item mostrado é o que ele devolveu (id real,
  // valores normalizados). Se falhar, a função lança com a mensagem do
  // servidor pra tela mostrar. Em modo demo (dev, API fora) segue local.
  const addServico = useCallback(async (input: NovoServicoInput) => {
    if (usingApi) {
      try {
        const criado: ServicoItem = await api.criarServico(input);
        setServicos(prev => [criado, ...prev]);
        return criado;
      } catch (e) {
        throw new Error(mensagemDoErro(e, 'Não foi possível salvar o serviço. Tente novamente.'));
      }
    }
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
    return novo;
  }, [usingApi]);

  const updateServico = useCallback(async (id: string, patch: Partial<NovoServicoInput>) => {
    if (usingApi) {
      try {
        const atualizado: ServicoItem = await api.atualizarServico(id, patch);
        setServicos(prev => prev.map(s => (s.id === id ? atualizado : s)));
        return;
      } catch (e) {
        throw new Error(mensagemDoErro(e, 'Não foi possível atualizar o serviço. Tente novamente.'));
      }
    }
    setServicos(prev => prev.map(s => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)));
  }, [usingApi]);

  const deleteServico = useCallback(async (id: string) => {
    if (usingApi) {
      try {
        await api.deletarServico(id);
      } catch (e) {
        throw new Error(mensagemDoErro(e, 'Não foi possível excluir o serviço. Tente novamente.'));
      }
    }
    setServicos(prev => prev.filter(s => s.id !== id));
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
    erro,
    stats,
    reload: load,
    addServico,
    updateServico,
    deleteServico,
    toggleAtivo,
  };
}

export type UseServicosReturn = ReturnType<typeof useServicos>;

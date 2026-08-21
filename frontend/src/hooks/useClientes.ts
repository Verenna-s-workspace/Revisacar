import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import { buildSeedClientes } from '../utils/clientes_utils';
import type { Cliente, NovoClienteInput } from '../types/cliente';

function makeId(): string {
  return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fonte de dados dos clientes (CRUD puro). Segue exatamente o mesmo padrão de
 * `useVeiculos`/`useAgendamentos`: tenta o endpoint `/clientes" primeiro e,
 * na ausência dele (backend ainda não expõe essa rota), cai para dados de
 * demonstração — para que a tela funcione de ponta a ponta mesmo antes do
 * backend implementar a persistência real.
 *
 * O cruzamento com Veículos/Agendamentos/Ordens (status derivado, veículos
 * vinculados, próximo agendamento etc.) NÃO acontece aqui — fica a cargo de
 * `enrichClientes` (ver `utils/clientes_utils.ts`), chamada pela própria
 * `ClientesPage` a partir dos hooks já existentes dessas telas.
 */
export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingApi, setUsingApi] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Mesmo padrão de useEstoque/useRelatorios: se a API falhar, só cai pra
  // dados de demonstração em desenvolvimento (import.meta.env.DEV). Em
  // produção mostra o erro real em vez de clientes fictícios. Uma resposta
  // bem sucedida (mesmo com lista vazia) nunca é substituída por dados de
  // demonstração, em nenhum ambiente.
  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await api.listarClientes();
      const lista: Cliente[] = Array.isArray(data) ? data : data?.clientes ?? [];
      setClientes(lista);
      setUsingApi(true);
    } catch {
      if (import.meta.env.DEV) {
        setClientes(buildSeedClientes());
        setUsingApi(false);
      } else {
        setClientes([]);
        setUsingApi(false);
        setErro('Não foi possível carregar os clientes.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCliente = useCallback(async (input: NovoClienteInput) => {
    const novo: Cliente = {
      id: makeId(),
      nome: input.nome,
      cpfCnpj: input.cpfCnpj,
      telefone: input.telefone,
      email: input.email,
      endereco: input.endereco,
      fotoPrincipal: input.fotoPrincipal,
      observacoes: input.observacoes,
      createdAt: new Date().toISOString(),
    };

    setClientes(prev => [novo, ...prev]);

    if (usingApi) {
      try {
        await api.criarCliente(input);
      } catch {
        setClientes(prev => prev.filter(c => c.id !== novo.id));
        throw new Error('Não foi possível salvar o cliente. Tente novamente.');
      }
    }
    return novo;
  }, [usingApi]);

  const updateCliente = useCallback(async (id: string, patch: Partial<NovoClienteInput>) => {
    const anterior = clientes.find(c => c.id === id);
    setClientes(prev => prev.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)));

    if (usingApi) {
      try {
        await api.atualizarCliente(id, patch);
      } catch {
        if (anterior) setClientes(prev => prev.map(c => (c.id === id ? anterior : c)));
        throw new Error('Não foi possível atualizar o cliente. Tente novamente.');
      }
    }
  }, [usingApi, clientes]);

  const deleteCliente = useCallback(async (id: string) => {
    const anterior = clientes.find(c => c.id === id);
    setClientes(prev => prev.filter(c => c.id !== id));

    if (usingApi) {
      try {
        await api.deletarCliente(id);
      } catch {
        if (anterior) setClientes(prev => [anterior, ...prev]);
        throw new Error('Não foi possível excluir o cliente. Tente novamente.');
      }
    }
  }, [usingApi, clientes]);

  return {
    clientes,
    loading,
    usingApi,
    erro,
    reload: load,
    addCliente,
    updateCliente,
    deleteCliente,
  };
}

export type UseClientesReturn = ReturnType<typeof useClientes>;

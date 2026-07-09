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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarClientes();
      const lista: Cliente[] = Array.isArray(data) ? data : data?.clientes ?? [];
      if (lista.length || Array.isArray(data)) {
        setClientes(lista);
        setUsingApi(true);
      } else {
        setClientes(buildSeedClientes());
        setUsingApi(false);
      }
    } catch {
      // Backend ainda não expõe /clientes — usa dados de demonstração.
      setClientes(buildSeedClientes());
      setUsingApi(false);
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
        // mantém o registro local mesmo se a chamada falhar
      }
    }
    return novo;
  }, [usingApi]);

  const updateCliente = useCallback(async (id: string, patch: Partial<NovoClienteInput>) => {
    setClientes(prev => prev.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)));

    if (usingApi) {
      try {
        await api.atualizarCliente(id, patch);
      } catch {
        // segue com o estado local
      }
    }
  }, [usingApi]);

  const deleteCliente = useCallback(async (id: string) => {
    setClientes(prev => prev.filter(c => c.id !== id));

    if (usingApi) {
      try {
        await api.deletarCliente(id);
      } catch {
        // já removido localmente
      }
    }
  }, [usingApi]);

  return {
    clientes,
    loading,
    usingApi,
    reload: load,
    addCliente,
    updateCliente,
    deleteCliente,
  };
}

export type UseClientesReturn = ReturnType<typeof useClientes>;

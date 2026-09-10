import { useCallback, useEffect, useState } from 'react';
import { api } from '../utils/api';
import type { Cliente, NovoClienteInput } from '../types/cliente';

function makeId(): string {
  return `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Fonte de dados dos clientes (CRUD puro). Agora tenta o endpoint `/clientes` e,
 * em caso de erro, retorna um array vazio (não há mais fallback para dados de
 * demonstração). O cruzamento com Veículos/Agendamentos/Ordens continua a ser
 * feito por `enrichClientes` (ver `utils/clientes_utils.ts`).
 */
export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarClientes();
      const lista: Cliente[] = Array.isArray(data) ? data : data?.clientes ?? [];
      setClientes(lista);
    } catch (error) {
      console.error('Failed to fetch clients', error);
      setClientes([]); // No fallback to seed data; return empty list on error
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
      pin: input.pin,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setClientes(prev => [novo, ...prev]);

    try {
      const createdCliente = await api.criarCliente(input);
      // Replace the optimistic client with the real one from the backend
      setClientes(prev => prev.map(c => c.id === novo.id ? createdCliente : c));
      return createdCliente;
    } catch (error) {
      // Rollback optimistic update on failure
      setClientes(prev => prev.filter(c => c.id !== novo.id));
      console.error('Failed to create client', error);
      throw error; // Re-throw to allow caller to handle if needed
    }
  }, []);

  const updateCliente = useCallback(async (id: string, patch: Partial<NovoClienteInput>) => {
    // Optimistic update
    setClientes(prev => prev.map(c => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)));

    try {
      await api.atualizarCliente(id, patch);
    } catch (error) {
      // Rollback optimistic update on failure
      setClientes(prev => prev.map(c => (c.id === id ? { ...c, updatedAt: undefined } : c))); // Simplified rollback
      console.error('Failed to update client', error);
      throw error;
    }
  }, []);

  const deleteCliente = useCallback(async (id: string) => {
    // Find the client to be deleted for potential rollback
    const clientToDelete = clientes.find(c => c.id === id);
    // Optimistic update
    setClientes(prev => prev.filter(c => c.id !== id));

    try {
      await api.deletarCliente(id);
    } catch (error) {
      // Rollback optimistic update on failure
      if (clientToDelete) {
        setClientes(prev => [...prev, clientToDelete]);
      }
      console.error('Failed to delete client', error);
      throw error;
    }
  }, [clientes]);

  return {
    clientes,
    loading,
    reload: load,
    addCliente,
    updateCliente,
    deleteCliente,
  };
}

export type UseClientesReturn = ReturnType<typeof useClientes>;
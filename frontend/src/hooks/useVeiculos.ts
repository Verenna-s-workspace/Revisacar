import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import type {
  NovoVeiculoInput,
  VeiculoCadastrado,
  VeiculoProprietario,
  VeiculoStatus,
} from '../types/veiculo';

function makeId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface VeiculoStats {
  total: number;
  naOficina: number;
  aguardandoAprovacao: number;
  prontoEntrega: number;
}

/**
 * Hook para gerenciamento de veículos. Agora chama a API diretamente e,
 * em caso de erro, retorna um array vazio (não há mais fallback para dados de
 * demonstração). O cruzamento com Clientes/Agendamentos/Ordens continua a ser
 * feito por `enrichClientes` (ver `utils/clientes_utils.ts`).
 */
export function useVeiculos() {
  const [veiculos, setVeiculos] = useState<VeiculoCadastrado[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarVeiculos();
      const lista: VeiculoCadastrado[] = Array.isArray(data) ? data : data?.veiculos ?? [];
      setVeiculos(lista);
    } catch (error) {
      console.error('Failed to fetch vehicles', error);
      setVeiculos([]); // No fallback to seed data; return empty list on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addVeiculo = useCallback(async (input: NovoVeiculoInput) => {
    const novo: VeiculoCadastrado = {
      id: makeId(),
      placa: input.placa,
      marca: input.marca,
      modelo: input.modelo,
      ano: input.ano,
      cor: input.cor,
      categoria: input.categoria,
      quilometragem: input.quilometragem,
      combustivel: input.combustivel,
      cambio: input.cambio,
      portas: input.portas,
      chassi: input.chassi,
      renavam: input.renavam,
      observacoes: input.observacoes,
      fotoPrincipal: input.fotoPrincipal,
      fotosAdicionais: input.fotosAdicionais ?? [],
      proprietario: input.proprietario ?? null,
      status: input.status ?? 'disponivel',
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setVeiculos(prev => [novo, ...prev]);

    try {
      await api.criarVeiculo(input);
    } catch (error) {
      // Rollback optimistic update on failure
      setVeiculos(prev => prev.filter(v => v.id !== novo.id));
      console.error('Failed to create vehicle', error);
      throw error;
    }

    return novo;
  }, []);

  const updateVeiculo = useCallback(async (id: string, patch: Partial<NovoVeiculoInput>) => {
    // Optimistic update
    setVeiculos(prev => prev.map(v => (v.id === id ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v)));

    try {
      await api.atualizarVeiculo(id, patch);
    } catch (error) {
      // Rollback optimistic update on failure
      setVeiculos(prev => prev.map(v => (v.id === id ? { ...v, updatedAt: undefined } : v))); // Simplified rollback
      console.error('Failed to update vehicle', error);
      throw error;
    }
  }, []);

  const deleteVeiculo = useCallback(async (id: string) => {
    // Find the vehicle to be deleted for potential rollback
    const vehicleToDelete = veiculos.find(v => v.id === id);
    // Optimistic update
    setVeiculos(prev => prev.filter(v => v.id !== id));

    try {
      await api.deletarVeiculo(id);
    } catch (error) {
      // Rollback optimistic update on failure
      if (vehicleToDelete) {
        setVeiculos(prev => [...prev, vehicleToDelete]);
      }
      console.error('Failed to delete vehicle', error);
      throw error;
    }
  }, [veiculos]);

  const changeOwner = useCallback(async (id: string, proprietario: VeiculoProprietario | null) => {
    await updateVeiculo(id, { proprietario });
  }, [updateVeiculo]);

  const changeStatus = useCallback(async (id: string, status: VeiculoStatus) => {
    await updateVeiculo(id, { status });
  }, [updateVeiculo]);

  const stats: VeiculoStats = useMemo(() => ({
    total: veiculos.length,
    naOficina: veiculos.filter(v => v.status === 'na_oficina').length,
    aguardandoAprovacao: veiculos.filter(v => v.status === 'aguardando_aprovacao').length,
    prontoEntrega: veiculos.filter(v => v.status === 'pronto_entrega').length,
  }), [veiculos]);

  return {
    veiculos,
    loading,
    reload: load,
    addVeiculo,
    updateVeiculo,
    deleteVeiculo,
    changeOwner,
    changeStatus,
    stats,
  };
}

export type UseVeiculosReturn = ReturnType<typeof useVeiculos>;
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { buildSeedVeiculos } from '../utils/veiculos_utils';
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

export function useVeiculos() {
  const [veiculos, setVeiculos] = useState<VeiculoCadastrado[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingApi, setUsingApi] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarVeiculos();
      const lista: VeiculoCadastrado[] = Array.isArray(data) ? data : data?.veiculos ?? [];
      if (lista.length || Array.isArray(data)) {
        setVeiculos(lista);
        setUsingApi(true);
      } else {
        setVeiculos(buildSeedVeiculos());
        setUsingApi(false);
      }
    } catch {
      // Backend ainda não expõe /veiculos — usa dados de demonstração.
      setVeiculos(buildSeedVeiculos());
      setUsingApi(false);
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

    setVeiculos(prev => [novo, ...prev]);

    if (usingApi) {
      try {
        await api.criarVeiculo(input);
      } catch {
        // mantém o registro local mesmo se a chamada falhar
      }
    }
    return novo;
  }, [usingApi]);

  const updateVeiculo = useCallback(async (id: string, patch: Partial<NovoVeiculoInput>) => {
    setVeiculos(prev => prev.map(v => (v.id === id ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v)));

    if (usingApi) {
      try {
        await api.atualizarVeiculo(id, patch);
      } catch {
        // segue com o estado local
      }
    }
  }, [usingApi]);

  const deleteVeiculo = useCallback(async (id: string) => {
    setVeiculos(prev => prev.filter(v => v.id !== id));

    if (usingApi) {
      try {
        await api.deletarVeiculo(id);
      } catch {
        // já removido localmente
      }
    }
  }, [usingApi]);

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
    usingApi,
    stats,
    reload: load,
    addVeiculo,
    updateVeiculo,
    deleteVeiculo,
    changeOwner,
    changeStatus,
  };
}

export type UseVeiculosReturn = ReturnType<typeof useVeiculos>;

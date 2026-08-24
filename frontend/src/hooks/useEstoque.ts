import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import {
  buildSeedEstoque,
  buildSeedKits,
  buildSeedMovimentos,
  calcularDisponibilidadeKit,
  itemEstaBaixo,
  valorTotalEstoque,
} from '../utils/estoque_utils';
import type {
  EstoqueItem,
  EstoqueKit,
  MovimentoEstoque,
  NovoEstoqueItemInput,
  NovoEstoqueKitInput,
  ResultadoAplicarKit,
} from '../types/estoque';

function makeItemId(): string {
  return `est-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function makeKitId(): string {
  return `kit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function makeMovId(): string {
  return `mov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface EstoqueStats {
  totalItens: number;
  valorTotal: number;
  itensBaixoEstoque: number;
  kitsDisponiveis: number;
}

export function useEstoque() {
  const [itens, setItens] = useState<EstoqueItem[]>([]);
  const [kits, setKits] = useState<EstoqueKit[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [usandoDadosDemo, setUsandoDadosDemo] = useState(false);

  // Mesmo padrão de fallback do hook de Relatórios (useRelatorios.ts) — e não o
  // de useVeiculos/useServicos: se a API falhar, só cai pra dados de
  // demonstração em desenvolvimento (import.meta.env.DEV). Em produção, um
  // backend fora do ar mostra o erro real em vez de estoque fictício —
  // estoque errado pode fazer alguém prometer ao cliente uma peça que não
  // existe de verdade, o mesmo tipo de risco que faturamento fictício nos
  // relatórios. Uma resposta bem sucedida (mesmo com listas vazias) nunca é
  // substituída por dados de demonstração, em nenhum ambiente.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [itensResp, kitsResp, movResp]: [EstoqueItem[], EstoqueKit[], MovimentoEstoque[]] = await Promise.all([
        api.listarEstoque(),
        api.listarKits(),
        api.listarMovimentosEstoque(),
      ]);
      setItens(itensResp);
      setKits(kitsResp);
      setMovimentos(movResp);
      setUsandoDadosDemo(false);
    } catch {
      if (import.meta.env.DEV) {
        setItens(buildSeedEstoque());
        setKits(buildSeedKits());
        setMovimentos(buildSeedMovimentos());
        setUsandoDadosDemo(true);
      } else {
        setErro('Não foi possível carregar o estoque.');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Itens ──────────────────────────────────────────────────────────────────

  const criarItem = useCallback(async (input: NovoEstoqueItemInput) => {
    const agora = new Date().toISOString();
    const novo: EstoqueItem = {
      id: makeItemId(),
      nome: input.nome,
      categoria: input.categoria,
      quantidade: input.quantidade,
      minimo: input.minimo,
      preco: input.preco,
      localizacao: input.localizacao,
      descricao: input.descricao,
      aplicacao: input.aplicacao,
      fotoDataUrl: input.fotoDataUrl,
      status: input.status,
      quarentena: input.status === 'quarentena' ? input.quarentena : undefined,
      createdAt: agora,
    };

    setItens(prev => [novo, ...prev]);

    if (novo.quantidade > 0) {
      setMovimentos(prev => [
        { id: makeMovId(), itemId: novo.id, tipo: 'entrada', quantidade: novo.quantidade, motivo: 'Cadastro inicial', criadoEm: agora },
        ...prev,
      ]);
    }

    if (!usandoDadosDemo) {
      try {
        await api.criarItemEstoque(input);
      } catch {
        // mantém o registro local mesmo se a chamada falhar
      }
    }
    return novo;
  }, [usandoDadosDemo]);

  const atualizarItem = useCallback(async (id: string, patch: Partial<NovoEstoqueItemInput>) => {
    const original = itens.find(i => i.id === id);

    setItens(prev =>
      prev.map(i => {
        if (i.id !== id) return i;
        const atualizado: EstoqueItem = { ...i, ...patch, updatedAt: new Date().toISOString() };
        if (atualizado.status !== 'quarentena') atualizado.quarentena = undefined;
        return atualizado;
      })
    );

    // Ajuste manual de quantidade pelo modal de edição também vira log —
    // sempre como 'ajuste' (não 'entrada'/'saida'), pra não contaminar o
    // relatório de "itens mais movimentados" (Fase 8), que soma só saídas
    // reais (aplicação de kit / uso avulso), não correções de cadastro.
    if (original && patch.quantidade !== undefined && patch.quantidade !== original.quantidade) {
      setMovimentos(prev => [
        {
          id: makeMovId(),
          itemId: id,
          tipo: 'ajuste',
          quantidade: Math.abs(patch.quantidade! - original.quantidade),
          motivo: `Ajuste manual: ${original.quantidade} → ${patch.quantidade}`,
          criadoEm: new Date().toISOString(),
        },
        ...prev,
      ]);
    }

    if (!usandoDadosDemo) {
      try {
        await api.atualizarItemEstoque(id, patch);
      } catch {
        // segue com o estado local
      }
    }
  }, [itens, usandoDadosDemo]);

  const excluirItem = useCallback(async (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id));
    if (!usandoDadosDemo) {
      try {
        await api.deletarItemEstoque(id);
      } catch {
        // já removido localmente
      }
    }
  }, [usandoDadosDemo]);

  // ── Kits ───────────────────────────────────────────────────────────────────

  const criarKit = useCallback(async (input: NovoEstoqueKitInput) => {
    const novo: EstoqueKit = {
      id: makeKitId(),
      nome: input.nome,
      descricao: input.descricao,
      itens: input.itens,
      servicoId: input.servicoId,
      fotoDataUrl: input.fotoDataUrl,
      createdAt: new Date().toISOString(),
    };
    setKits(prev => [novo, ...prev]);
    if (!usandoDadosDemo) {
      try {
        await api.criarKit(input);
      } catch {
        // mantém o registro local mesmo se a chamada falhar
      }
    }
    return novo;
  }, [usandoDadosDemo]);

  const atualizarKit = useCallback(async (id: string, patch: Partial<NovoEstoqueKitInput>) => {
    setKits(prev => prev.map(k => (k.id === id ? { ...k, ...patch, updatedAt: new Date().toISOString() } : k)));
    if (!usandoDadosDemo) {
      try {
        await api.atualizarKit(id, patch);
      } catch {
        // segue com o estado local
      }
    }
  }, [usandoDadosDemo]);

  const excluirKit = useCallback(async (id: string) => {
    setKits(prev => prev.filter(k => k.id !== id));
    if (!usandoDadosDemo) {
      try {
        await api.deletarKit(id);
      } catch {
        // já removido localmente
      }
    }
  }, [usandoDadosDemo]);

  /**
   * Valida TODOS os componentes antes de aplicar qualquer baixa — nunca
   * aplica parcial. Se algum item não tiver quantidade suficiente (ou
   * estiver em quarentena, ou tiver sido excluído), bloqueia e diz qual.
   */
  const aplicarKit = useCallback(async (id: string): Promise<ResultadoAplicarKit> => {
    const kit = kits.find(k => k.id === id);
    if (!kit) return { ok: false, mensagem: 'Kit não encontrado.' };
    if (kit.itens.length === 0) return { ok: false, mensagem: 'Este kit não tem componentes cadastrados.' };

    for (const receita of kit.itens) {
      const item = itens.find(i => i.id === receita.itemId);
      if (!item) return { ok: false, mensagem: 'Um dos componentes do kit não existe mais no estoque.' };
      if (item.status === 'quarentena') {
        return { ok: false, mensagem: `${item.nome} está em quarentena e não pode ser usado.` };
      }
      if (item.quantidade < receita.quantidade) {
        return {
          ok: false,
          mensagem: `Estoque insuficiente de ${item.nome} (precisa de ${receita.quantidade}, disponível ${item.quantidade}).`,
        };
      }
    }

    const agora = new Date().toISOString();

    setItens(prev =>
      prev.map(i => {
        const receita = kit.itens.find(r => r.itemId === i.id);
        return receita ? { ...i, quantidade: i.quantidade - receita.quantidade, updatedAt: agora } : i;
      })
    );

    setMovimentos(prev => [
      ...kit.itens.map(
        (receita, idx): MovimentoEstoque => ({
          id: `${makeMovId()}-${idx}`,
          itemId: receita.itemId,
          tipo: 'saida',
          quantidade: receita.quantidade,
          motivo: `Kit: ${kit.nome}`,
          criadoEm: agora,
        })
      ),
      ...prev,
    ]);

    if (!usandoDadosDemo) {
      try {
        await api.aplicarKit(id);
      } catch {
        // baixa local já aplicada
      }
    }

    return { ok: true };
  }, [kits, itens, usandoDadosDemo]);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const itensPorId = useMemo(() => new Map(itens.map(i => [i.id, i])), [itens]);

  const disponibilidadeKit = useCallback(
    (kit: EstoqueKit) => calcularDisponibilidadeKit(kit, itensPorId),
    [itensPorId]
  );

  const stats: EstoqueStats = useMemo(
    () => ({
      totalItens: itens.filter(i => i.status === 'ativo').length,
      valorTotal: valorTotalEstoque(itens),
      itensBaixoEstoque: itens.filter(itemEstaBaixo).length,
      kitsDisponiveis: kits.filter(k => calcularDisponibilidadeKit(k, itensPorId) > 0).length,
    }),
    [itens, kits, itensPorId]
  );

  return {
    itens,
    kits,
    movimentos,
    carregando,
    erro,
    usandoDadosDemo,
    stats,
    recarregar: carregar,
    criarItem,
    atualizarItem,
    excluirItem,
    criarKit,
    atualizarKit,
    excluirKit,
    aplicarKit,
    disponibilidadeKit,
  };
}

export type UseEstoqueReturn = ReturnType<typeof useEstoque>;

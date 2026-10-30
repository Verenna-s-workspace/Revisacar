import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { limparOpcionais, mensagemDoErro } from '../utils/api_erro';
import {
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

  // Se a API falhar, mostra o erro real: estoque errado pode fazer alguém prometer ao
  // cliente uma peça que não existe de verdade. Uma resposta bem-sucedida (mesmo com listas
  // vazias) é sempre exibida como veio.
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
    } catch {
      setErro('Não foi possível carregar o estoque.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Itens ──────────────────────────────────────────────────────────────────

  // O servidor é a fonte da verdade: nada é mostrado antes dele
  // confirmar, e o item mostrado é o que ele devolveu (com o id real). Os
  // movimentos são recarregados porque o backend é quem registra o log.
  const recarregarMovimentos = useCallback(async () => {
    try {
      setMovimentos(await api.listarMovimentosEstoque());
    } catch {
      // o log só fica defasado até a próxima carga
    }
  }, []);

  const criarItem = useCallback(async (input: NovoEstoqueItemInput) => {
    try {
      const criado: EstoqueItem = await api.criarItemEstoque(input);
      setItens(prev => [criado, ...prev]);
      void recarregarMovimentos();
      return criado;
    } catch (e) {
      throw new Error(mensagemDoErro(e, 'Não foi possível salvar o item no estoque. Tente novamente.'));
    }
  }, [recarregarMovimentos]);

  const atualizarItem = useCallback(async (id: string, patch: Partial<NovoEstoqueItemInput>) => {
    const original = itens.find(i => i.id === id);

    try {
      const atualizado: EstoqueItem = await api.atualizarItemEstoque(id, limparOpcionais(patch, ['fotoDataUrl']));
      setItens(prev => prev.map(i => (i.id === id ? atualizado : i)));
      if (original && atualizado.quantidade !== original.quantidade) void recarregarMovimentos();
      return;
    } catch (e) {
      throw new Error(mensagemDoErro(e, 'Não foi possível atualizar o item. Tente novamente.'));
    }
  }, [itens, recarregarMovimentos]);

  const excluirItem = useCallback(async (id: string) => {
    try {
      await api.deletarItemEstoque(id);
    } catch (e) {
      // Ex.: 409 "faz parte do kit X" — a mensagem do servidor explica o que fazer.
      throw new Error(mensagemDoErro(e, 'Não foi possível excluir o item. Tente novamente.'));
    }
    setMovimentos(prev => prev.filter(m => m.itemId !== id)); // o banco apaga o log junto
    setItens(prev => prev.filter(i => i.id !== id));
  }, []);

  // ── Kits ───────────────────────────────────────────────────────────────────

  const criarKit = useCallback(async (input: NovoEstoqueKitInput) => {
    try {
      const criado: EstoqueKit = await api.criarKit(input);
      setKits(prev => [criado, ...prev]);
      return criado;
    } catch (e) {
      throw new Error(mensagemDoErro(e, 'Não foi possível salvar o kit. Tente novamente.'));
    }
  }, []);

  const atualizarKit = useCallback(async (id: string, patch: Partial<NovoEstoqueKitInput>) => {
    try {
      const atualizado: EstoqueKit = await api.atualizarKit(id, limparOpcionais(patch, ['fotoDataUrl', 'servicoId']));
      setKits(prev => prev.map(k => (k.id === id ? atualizado : k)));
      return;
    } catch (e) {
      throw new Error(mensagemDoErro(e, 'Não foi possível atualizar o kit. Tente novamente.'));
    }
  }, []);

  const excluirKit = useCallback(async (id: string) => {
    try {
      await api.deletarKit(id);
    } catch (e) {
      throw new Error(mensagemDoErro(e, 'Não foi possível excluir o kit. Tente novamente.'));
    }
    setKits(prev => prev.filter(k => k.id !== id));
  }, []);

  /**
   * Nunca aplica parcial. Quem valida e dá a baixa (tudo-ou-nada, com trava contra
   * duas pessoas usando a mesma peça) é o servidor; o estado local só reflete o que
   * ele devolveu.
   */
  const aplicarKit = useCallback(async (id: string): Promise<ResultadoAplicarKit> => {
    const kit = kits.find(k => k.id === id);
    if (!kit) return { ok: false, mensagem: 'Kit não encontrado.' };
    if (kit.itens.length === 0) return { ok: false, mensagem: 'Este kit não tem componentes cadastrados.' };

    try {
      const r: { ok: boolean; mensagem?: string; itens?: EstoqueItem[]; movimentos?: MovimentoEstoque[] } =
        await api.aplicarKit(id);
      if (!r.ok) return { ok: false, mensagem: r.mensagem ?? 'Não foi possível aplicar o kit.' };
      const atualizados = new Map((r.itens ?? []).map(i => [i.id, i]));
      setItens(prev => prev.map(i => atualizados.get(i.id) ?? i));
      setMovimentos(prev => [...(r.movimentos ?? []), ...prev]);
      return { ok: true };
    } catch (e) {
      return { ok: false, mensagem: mensagemDoErro(e, 'Não foi possível aplicar o kit. Tente novamente.') };
    }
  }, [kits]);

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

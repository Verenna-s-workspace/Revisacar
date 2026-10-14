import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import type { Transacao, Categorias } from '../features/Dashboard/Financeiro/types';
import type { ResumoFinanceiro } from '../features/Dashboard/Financeiro/KpiCards';
import {
  buildSeedCategorias,
  buildSeedResumo,
  buildSeedTransacoes,
  filtrarSeedPorPeriodo,
} from '../utils/financeiro_utils';

const CATEGORIAS_VAZIAS: Categorias = { entrada: [], saida: [], formas_pagamento: [] };

function fusoDoNavegador(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

interface Opcoes {
  de: string;
  ate: string;
  podeVer: boolean;
  podeVerMargem: boolean;
}

/**
 * Dados do Financeiro do período escolhido: KPIs, lançamentos e contas
 * pendentes (a pagar/receber, sem limite de período).
 *
 * Só a resposta da ÚLTIMA carga vale: trocar de período rápido não deixa a
 * resposta lenta do período antigo sobrescrever a do novo.
 *
 * Se a carga falhar, cai pra dados de demonstração só em desenvolvimento
 * (import.meta.env.DEV) — em produção mostra o erro de verdade, porque
 * faturamento e margem fictícios levam a decisão real em cima de número
 * inventado. Resposta bem-sucedida (mesmo vazia) nunca é trocada por demo.
 */
export function useFinanceiro({ de, ate, podeVer, podeVerMargem }: Opcoes) {
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [pendentesReceber, setPendentesReceber] = useState<Transacao[]>([]);
  const [pendentesPagar, setPendentesPagar] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categorias>(CATEGORIAS_VAZIAS);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [usandoDadosDemo, setUsandoDadosDemo] = useState(false);
  const ultimaCarga = useRef(0);

  const carregar = useCallback(async () => {
    if (!podeVer) return;
    const carga = ++ultimaCarga.current;
    const tz = fusoDoNavegador();
    setCarregando(true);
    setErro(null);
    try {
      const [r, t, pr, pp] = await Promise.all([
        api.resumoFinanceiro({ de, ate, tz }),
        api.listarTransacoes({ de, ate, tz }),
        api.listarTransacoes({ status: 'pendente', tipo: 'entrada', semPeriodo: true, tz }),
        api.listarTransacoes({ status: 'pendente', tipo: 'saida', semPeriodo: true, tz }),
      ]);
      if (carga !== ultimaCarga.current) return;
      setResumo(r);
      setTransacoes(t);
      setPendentesReceber(pr);
      setPendentesPagar(pp);
      setUsandoDadosDemo(false);
    } catch (e) {
      if (carga !== ultimaCarga.current) return;
      if (import.meta.env.DEV) {
        const todas = buildSeedTransacoes();
        setResumo(buildSeedResumo(todas, de, ate, podeVerMargem));
        setTransacoes(filtrarSeedPorPeriodo(todas, de, ate));
        setPendentesReceber(todas.filter(x => x.status === 'pendente' && x.tipo === 'entrada'));
        setPendentesPagar(todas.filter(x => x.status === 'pendente' && x.tipo === 'saida'));
        setUsandoDadosDemo(true);
      } else {
        setErro(mensagemDoErro(e, 'Não foi possível carregar os dados financeiros.'));
      }
    } finally {
      if (carga === ultimaCarga.current) setCarregando(false);
    }
  }, [podeVer, de, ate, podeVerMargem]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!podeVer) return;
    api.categoriasFinanceiro()
      .then(setCategorias)
      .catch(() => { if (import.meta.env.DEV) setCategorias(buildSeedCategorias()); });
  }, [podeVer]);

  // As ações propagam o erro (o chamador decide onde mostrá-lo) e, dando
  // certo, recarregam tudo — os KPIs dependem do conjunto inteiro.
  const criar = useCallback(async (payload: Record<string, unknown>) => {
    await api.criarTransacao(payload);
    await carregar();
  }, [carregar]);

  const atualizar = useCallback(async (id: string, payload: Record<string, unknown>) => {
    await api.atualizarTransacao(id, payload);
    await carregar();
  }, [carregar]);

  const cancelar = useCallback(async (id: string) => {
    await api.removerTransacao(id);
    await carregar();
  }, [carregar]);

  return {
    resumo,
    transacoes,
    pendentesReceber,
    pendentesPagar,
    categorias,
    carregando,
    erro,
    setErro,
    usandoDadosDemo,
    recarregar: carregar,
    criar,
    atualizar,
    cancelar,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import type { VisaoGeral } from '../types/visao_geral';

function fusoDoNavegador(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Números da Visão Geral — calculados no servidor (GET /visao-geral).
 *
 * Sem dados de demonstração, de propósito: são números de faturamento de
 * verdade, então backend fora do ar mostra o erro (com "tentar novamente"),
 * nunca valores fictícios. Os blocos de dinheiro só existem na resposta para
 * quem tem permissão.
 */
export function useVisaoGeral() {
  const [dados, setDados] = useState<VisaoGeral | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ultimaChamada = useRef(0);

  const carregar = useCallback(async () => {
    const chamada = ++ultimaChamada.current;
    setLoading(true);
    setErro(null);
    try {
      const resposta: VisaoGeral = await api.visaoGeral(fusoDoNavegador());
      if (chamada !== ultimaChamada.current) return;
      setDados(resposta);
    } catch (e) {
      if (chamada !== ultimaChamada.current) return;
      setDados(null);
      setErro(mensagemDoErro(e, 'Não foi possível carregar a Visão Geral.'));
    } finally {
      if (chamada === ultimaChamada.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Salva a meta mensal (null remove). Lança Error com a mensagem do servidor se falhar. */
  const salvarMeta = useCallback(async (valor: number | null) => {
    try {
      const res: { valor: number | null } = await api.definirMetaMensal(valor);
      setDados((atual) => (atual?.meta ? { ...atual, meta: { ...atual.meta, valor: res.valor } } : atual));
    } catch (e) {
      throw new Error(mensagemDoErro(e, 'Não foi possível salvar a meta.'));
    }
  }, []);

  return { dados, loading, erro, recarregar: carregar, salvarMeta };
}

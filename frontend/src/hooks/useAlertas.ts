import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import { buildSeedOrdensAtendimento } from '../utils/atendimento_utils';
import { buildSeedEstoque } from '../utils/estoque_utils';
import { agruparAlertas, gerarAlertas } from '../utils/alertas';
import type { OrdemRow } from '../types/dashboard';
import type { EstoqueItem } from '../types/estoque';

type Dados = { ordens: OrdemRow[]; estoque: EstoqueItem[] };

// Sidebar, sino e tela montam juntos e cada um usa este hook: enquanto uma busca
// está em andamento, todos aguardam a mesma em vez de repetir as chamadas.
let emAndamento: Promise<Dados> | null = null;
function buscarDados(): Promise<Dados> {
  if (!emAndamento) {
    emAndamento = Promise.all([api.listarOrdens(), api.listarEstoque()])
      .then(([ordens, estoque]) => ({
        ordens: Array.isArray(ordens) ? ordens : [],
        estoque: Array.isArray(estoque) ? estoque : [],
      }))
      .finally(() => { emAndamento = null; });
  }
  return emAndamento;
}

/**
 * Lista de alertas da oficina (ver utils/alertas.ts pra regra de cada tipo).
 *
 * Busca só o que as fontes precisam. Quando uma fonte nova (orçamento, financeiro)
 * precisar de dado novo, é aqui que ele passa a ser buscado.
 *
 * Em desenvolvimento, se a API falhar, usa os mesmos dados de demonstração do
 * Atendimento/Estoque; em produção mostra o erro — nunca "nenhum alerta" por engano.
 */
export function useAlertas() {
  const [dados, setDados] = useState<Dados>({ ordens: [], estoque: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    (async () => {
      try {
        const novos = await buscarDados();
        if (cancelado) return;
        setDados(novos);
        setErro(null);
      } catch (e) {
        if (cancelado) return;
        if (import.meta.env.DEV) {
          setDados({ ordens: buildSeedOrdensAtendimento(), estoque: buildSeedEstoque() });
          setErro(null);
        } else {
          setDados({ ordens: [], estoque: [] });
          setErro(mensagemDoErro(e, 'Não foi possível carregar os alertas.'));
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [tick]);

  const alertas = useMemo(() => gerarAlertas(dados), [dados]);
  const grupos = useMemo(() => agruparAlertas(alertas), [alertas]);
  const recarregar = useCallback(() => setTick(t => t + 1), []);

  return { alertas, grupos, total: alertas.length, loading, erro, recarregar };
}

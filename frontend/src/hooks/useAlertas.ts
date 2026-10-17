import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import { buildSeedOrdensAtendimento } from '../utils/atendimento_utils';
import { migrarAvisadosLocais } from '../utils/cliente_avisado';
import { buildSeedEstoque } from '../utils/estoque_utils';
import { agruparAlertas, gerarAlertas } from '../utils/alertas';
import type { AlertasBackend } from '../types/alertas';
import type { OrdemRow } from '../types/dashboard';
import type { EstoqueItem } from '../types/estoque';

type Dados = { ordens: OrdemRow[]; estoque: EstoqueItem[]; backend: AlertasBackend | null; backendFalhou: boolean };

function fusoDoNavegador(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

// Sidebar, sino e tela montam juntos e cada um usa este hook: enquanto uma busca
// está em andamento, todos aguardam a mesma em vez de repetir as chamadas.
let emAndamento: Promise<Dados> | null = null;
function buscarDados(): Promise<Dados> {
  if (!emAndamento) {
    emAndamento = Promise.all([
      api.listarOrdens(),
      api.listarEstoque(),
      // Os alertas que dependem do banco (orçamento, reservas, pagamento) são um extra:
      // se falhar, o resto continua e a tela avisa que veio incompleto.
      api.obterAlertas(fusoDoNavegador()).then((b: AlertasBackend) => ({ b, falhou: false }), () => ({ b: null, falhou: true })),
    ])
      .then(([ordens, estoque, extra]) => ({
        ordens: Array.isArray(ordens) ? ordens : [],
        estoque: Array.isArray(estoque) ? estoque : [],
        backend: extra.b && typeof extra.b === 'object' && !Array.isArray(extra.b) ? extra.b : null,
        backendFalhou: extra.falhou || !extra.b || Array.isArray(extra.b),
      }))
      .finally(() => { emAndamento = null; });
  }
  return emAndamento;
}

const SCRIPT_DA_ORIGEM: Record<string, string> = {
  orcamentos: 'orcamentos.sql',
  estoque_reservas: 'orcamentos.sql',
  financeiro: 'financeiro.sql',
};

/**
 * Lista de alertas da oficina (ver utils/alertas.ts pra regra de cada tipo).
 *
 * Em desenvolvimento, se a API de ordens/estoque falhar, usa os mesmos dados de
 * demonstração do Atendimento/Estoque; em produção mostra o erro — nunca
 * "nenhum alerta" por engano. `avisos` lista o que veio incompleto (ex.: alertas de
 * financeiro indisponíveis) pra tela não fingir que está tudo conferido.
 */
export function useAlertas() {
  const [dados, setDados] = useState<Dados>({ ordens: [], estoque: [], backend: null, backendFalhou: false });
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
        void migrarAvisadosLocais(novos.ordens).then(ids => {
          if (!cancelado && ids.length) {
            setDados(prev => ({ ...prev, ordens: prev.ordens.map(o => (ids.includes(o.id) ? { ...o, cliente_avisado: true } : o)) }));
          }
        });
      } catch (e) {
        if (cancelado) return;
        if (import.meta.env.DEV) {
          setDados({ ordens: buildSeedOrdensAtendimento(), estoque: buildSeedEstoque(), backend: null, backendFalhou: false });
          setErro(null);
        } else {
          setDados({ ordens: [], estoque: [], backend: null, backendFalhou: false });
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
  const avisos = useMemo(() => {
    const out: string[] = [];
    if (dados.backendFalhou) {
      out.push('Os alertas de orçamento, peças reservadas e financeiro não puderam ser carregados agora.');
    } else if (dados.backend?.indisponiveis?.length) {
      const scripts = [...new Set(dados.backend.indisponiveis.map(o => SCRIPT_DA_ORIGEM[o] ?? o))];
      out.push(`Alguns alertas ainda não estão disponíveis no banco. Rode ${scripts.join(' e ')} no Supabase.`);
    }
    return out;
  }, [dados]);
  const recarregar = useCallback(() => setTick(t => t + 1), []);

  return { alertas, grupos, total: alertas.length, loading, erro, avisos, recarregar };
}

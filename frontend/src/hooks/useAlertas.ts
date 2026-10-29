import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import { buildSeedOrdensAtendimento } from '../utils/atendimento_utils';
import { migrarAvisadosLocais } from '../utils/cliente_avisado';
import { buildSeedEstoque } from '../utils/estoque_utils';
import { agruparAlertas, aplicarEscondidos, dispensadosResolvidos, fontesCompletas, gerarAlertas } from '../utils/alertas';
import type { AlertaEscondidoApi, AlertasBackend } from '../types/alertas';
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

// O que o usuário escondeu (adiar/dispensar) é um estado só pra todos os usos do hook:
// esconder na tela de Alertas já tira o alerta da contagem da sidebar, do sino e do painel.
let escondidosAtuais: AlertaEscondidoApi[] = [];
const ouvintes = new Set<() => void>();
function definirEscondidos(lista: AlertaEscondidoApi[]) {
  escondidosAtuais = lista;
  ouvintes.forEach(f => f());
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const lerEscondidos = () => escondidosAtuais;

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
      .then(dados => {
        sincronizarEscondidos(dados);
        return dados;
      })
      .finally(() => { emAndamento = null; });
  }
  return emAndamento;
}

/** Atualiza o que está escondido com o que o banco disse e apaga os dispensados cujo problema já passou. */
function sincronizarEscondidos(dados: Dados) {
  // Se o bloco do banco não veio, não dá pra saber o que está escondido: fica como estava.
  if (dados.backendFalhou || !dados.backend) return;
  const doBanco = Array.isArray(dados.backend.dispensados) ? dados.backend.dispensados : [];
  definirEscondidos(doBanco);
  const ids = dispensadosResolvidos(doBanco, gerarAlertas(dados), fontesCompletas(dados.backend));
  if (!ids.length) return;
  // Melhor esforço: se falhar, tenta de novo na próxima carga.
  void api.limparAlertasDispensados(ids).then(
    () => definirEscondidos(escondidosAtuais.filter(e => !(e.ate === null && ids.includes(e.alertaId)))),
    () => undefined,
  );
}

const SCRIPT_DA_ORIGEM: Record<string, string> = {
  orcamentos: 'orcamentos.sql',
  estoque_reservas: 'orcamentos.sql',
  financeiro: 'financeiro.sql',
  orcamento_link: 'orcamento_link.sql',
  alertas_dispensados: 'alertas.sql',
};

/**
 * Lista de alertas da oficina (ver utils/alertas.ts pra regra de cada tipo).
 *
 * Em desenvolvimento, se a API de ordens/estoque falhar, usa os mesmos dados de
 * demonstração do Atendimento/Estoque; em produção mostra o erro — nunca
 * "nenhum alerta" por engano. `avisos` lista o que veio incompleto (ex.: alertas de
 * financeiro indisponíveis) pra tela não fingir que está tudo conferido.
 *
 * `alertas`/`grupos`/`total` já descontam o que o usuário adiou ou dispensou (por usuário, no
 * banco); `escondidos` é essa parte, pra tela deixar voltar a mostrar.
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

  const escondidosApi = useSyncExternalStore(assinar, lerEscondidos);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const todos = useMemo(() => gerarAlertas(dados), [dados]);
  const { visiveis: alertas, escondidos } = useMemo(() => aplicarEscondidos(todos, escondidosApi), [todos, escondidosApi]);
  const grupos = useMemo(() => agruparAlertas(alertas), [alertas]);
  const avisos = useMemo(() => {
    const out: string[] = [];
    if (dados.backendFalhou) {
      out.push('Os alertas de orçamento, peças reservadas e financeiro não puderam ser carregados agora.');
    } else if (dados.backend?.indisponiveis?.length) {
      const scripts = [...new Set(dados.backend.indisponiveis.map(o => SCRIPT_DA_ORIGEM[o] ?? o))];
      out.push(`Alguns recursos de alertas ainda não estão disponíveis no banco. Rode ${scripts.join(' e ')} no Supabase.`);
    }
    return out;
  }, [dados]);
  const recarregar = useCallback(() => { api.esquecerLeituras(); setTick(t => t + 1); }, []);

  // Esconde na hora (otimista) e desfaz se o servidor recusar.
  const esconder = useCallback(async (alertaId: string, ate: string | null, chamar: () => Promise<AlertaEscondidoApi>) => {
    const antes = escondidosAtuais;
    setErroAcao(null);
    definirEscondidos([...antes.filter(e => e.alertaId !== alertaId), { alertaId, ate }]);
    try {
      const salvo = await chamar();
      if (salvo && typeof salvo === 'object' && salvo.alertaId === alertaId) {
        definirEscondidos([...escondidosAtuais.filter(e => e.alertaId !== alertaId), { alertaId, ate: salvo.ate ?? null }]);
      }
      return true;
    } catch (e) {
      definirEscondidos(escondidosAtuais.filter(x => x.alertaId !== alertaId).concat(antes.filter(x => x.alertaId === alertaId)));
      setErroAcao(mensagemDoErro(e, 'Não foi possível esconder o alerta.'));
      return false;
    }
  }, []);

  const adiar = useCallback(
    (alertaId: string, dias: number) =>
      esconder(alertaId, new Date(Date.now() + dias * 86_400_000).toISOString(), () => api.adiarAlerta(alertaId, dias)),
    [esconder],
  );
  const dispensar = useCallback(
    (alertaId: string) => esconder(alertaId, null, () => api.dispensarAlerta(alertaId)),
    [esconder],
  );
  const restaurar = useCallback(async (alertaId: string) => {
    const antes = escondidosAtuais;
    setErroAcao(null);
    definirEscondidos(antes.filter(e => e.alertaId !== alertaId));
    try {
      await api.restaurarAlerta(alertaId);
      return true;
    } catch (e) {
      definirEscondidos(antes);
      setErroAcao(mensagemDoErro(e, 'Não foi possível voltar a mostrar o alerta.'));
      return false;
    }
  }, []);

  return {
    alertas, grupos, total: alertas.length, escondidos, loading, erro, avisos, recarregar,
    adiar, dispensar, restaurar, erroAcao, limparErroAcao: () => setErroAcao(null),
  };
}

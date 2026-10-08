import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { mensagemDoErro } from '../utils/api_erro';
import type {
  FaturamentoOrigem,
  FiltroPeriodo,
  KpisRelatorio,
  MediaDiaria,
  RelatorioResposta,
} from '../types/relatorios';
import {
  agregarOrdensLocal,
  agruparServicosMaisRealizados,
  buildSeedOrdens,
  calcularVariacao,
  chaveDia,
  formatarMes,
  montarSerieDeDias,
  resolverIntervalo,
  resolverIntervaloAnterior,
} from '../utils/relatorios';

const FILTRO_PADRAO: FiltroPeriodo = { preset: 'ultimos_30_dias' };

const SEM_DADOS: RelatorioResposta = {
  faturamentoOrigem: 'estimado',
  totais: { atual: { faturamento: 0, ordens: 0, finalizadas: 0 }, anterior: null },
  dias: [],
  servicos: [],
};

function fusoDoNavegador(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function useRelatorios() {
  const [dados, setDados] = useState<RelatorioResposta>(SEM_DADOS);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [usandoDadosDemo, setUsandoDadosDemo] = useState(false);
  const [filtro, setFiltro] = useState<FiltroPeriodo>(FILTRO_PADRAO);

  const intervaloAtual = useMemo(
    () => resolverIntervalo(filtro.preset, filtro.personalizado),
    [filtro]
  );
  const intervaloAnterior = useMemo(
    () => resolverIntervaloAnterior(filtro.preset, intervaloAtual),
    [filtro.preset, intervaloAtual]
  );

  // Chaves de texto dos intervalos: dependência estável do efeito (os objetos
  // Date mudam de identidade a cada render do useMemo mesmo com o mesmo dia).
  const de = chaveDia(intervaloAtual.inicio);
  const ate = chaveDia(intervaloAtual.fim);
  const deAnterior = chaveDia(intervaloAnterior.inicio);
  const ateAnterior = chaveDia(intervaloAnterior.fim);

  // Só a resposta da ÚLTIMA chamada vale: trocar de período rápido não pode
  // deixar a resposta lenta do período antigo sobrescrever a do novo.
  const ultimaChamada = useRef(0);

  // O servidor agrega (GET /relatorios) e devolve só totais e séries por dia;
  // aqui sobra agrupar em semana/mês e desenhar. Muda o período, busca de novo.
  //
  // Se a chamada falhar, cai para dados de demonstração — mas só em
  // desenvolvimento (import.meta.env.DEV), igual aos outros hooks. Aqui é
  // faturamento de verdade, então em produção um backend fora do ar mostra o
  // erro real em vez de números fictícios. Uma resposta bem-sucedida com
  // período vazio nunca é substituída por dados falsos, em nenhum ambiente.
  const carregar = useCallback(async () => {
    const chamada = ++ultimaChamada.current;
    setCarregando(true);
    setErro(null);
    try {
      const resposta: RelatorioResposta = await api.relatorios({
        de,
        ate,
        deAnterior,
        ateAnterior,
        tz: fusoDoNavegador(),
      });
      if (chamada !== ultimaChamada.current) return;
      setDados(resposta);
      setUsandoDadosDemo(false);
    } catch (e) {
      if (chamada !== ultimaChamada.current) return;
      if (import.meta.env.DEV) {
        setDados(agregarOrdensLocal(buildSeedOrdens(), intervaloAtual, intervaloAnterior));
        setUsandoDadosDemo(true);
      } else {
        setDados(SEM_DADOS);
        setErro(mensagemDoErro(e, 'Não foi possível carregar os relatórios.'));
      }
    } finally {
      if (chamada === ultimaChamada.current) setCarregando(false);
    }
    // intervaloAtual/intervaloAnterior só entram no demo; mudam junto com as chaves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate, deAnterior, ateAnterior]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const { atual, anterior } = dados.totais;
  const temPeriodoAnteriorComDados = anterior !== null;

  const kpis: KpisRelatorio = useMemo(() => {
    // Ticket médio = faturamento ÷ OS finalizadas — mesma população usada no
    // faturamento, para o número continuar significando "valor médio por
    // serviço concluído" (dividir pelo total de OS, incluindo as ainda em
    // andamento, distorceria a média para baixo).
    const ticketAtual = atual.finalizadas > 0 ? atual.faturamento / atual.finalizadas : 0;
    const ticketAnterior = !anterior
      ? null
      : anterior.finalizadas > 0
      ? anterior.faturamento / anterior.finalizadas
      : 0;
    const faturamentoAnterior = anterior ? anterior.faturamento : null;
    const ordensAnterior = anterior ? anterior.ordens : null;

    return {
      faturamento: {
        atual: atual.faturamento,
        anterior: faturamentoAnterior,
        variacaoPercentual: calcularVariacao(atual.faturamento, faturamentoAnterior),
      },
      ordensServico: {
        atual: atual.ordens,
        anterior: ordensAnterior,
        variacaoPercentual: calcularVariacao(atual.ordens, ordensAnterior),
      },
      ticketMedio: {
        atual: ticketAtual,
        anterior: ticketAnterior,
        variacaoPercentual: calcularVariacao(ticketAtual, ticketAnterior),
      },
    };
  }, [atual, anterior]);

  const serieFaturamento = useMemo(
    () => montarSerieDeDias(dados.dias, intervaloAtual, intervaloAnterior, (d) => d.faturamento),
    [dados.dias, intervaloAtual, intervaloAnterior]
  );

  const serieOrdens = useMemo(
    () => montarSerieDeDias(dados.dias, intervaloAtual, intervaloAnterior, (d) => d.ordens),
    [dados.dias, intervaloAtual, intervaloAnterior]
  );

  const servicosMaisRealizados = useMemo(
    () => agruparServicosMaisRealizados(dados.servicos),
    [dados.servicos]
  );

  // Média diária só é exibida em comparações mensais (este mês / mês
  // passado), onde meses de tamanhos diferentes tornam o total bruto
  // enganoso — ex.: abril (30 dias) parecer "mais fraco" que março (31)
  // mesmo tendo desempenho diário melhor.
  const mediaDiaria: MediaDiaria | null = useMemo(() => {
    if (filtro.preset !== 'este_mes' && filtro.preset !== 'mes_passado') return null;

    const diasAtual = Math.max(1, contarDiasEntre(intervaloAtual.inicio, intervaloAtual.fim));
    const periodoAtual = {
      total: atual.ordens,
      dias: diasAtual,
      media: atual.ordens / diasAtual,
      rotulo: formatarMes(intervaloAtual.inicio),
    };

    if (!anterior) return { atual: periodoAtual, anterior: null };

    const diasAnterior = Math.max(1, contarDiasEntre(intervaloAnterior.inicio, intervaloAnterior.fim));
    return {
      atual: periodoAtual,
      anterior: {
        total: anterior.ordens,
        dias: diasAnterior,
        media: anterior.ordens / diasAnterior,
        rotulo: formatarMes(intervaloAnterior.inicio),
      },
    };
  }, [filtro.preset, intervaloAtual, intervaloAnterior, atual, anterior]);

  const faturamentoOrigem: FaturamentoOrigem = dados.faturamentoOrigem;

  return {
    carregando,
    erro,
    usandoDadosDemo,
    filtro,
    setFiltro,
    intervaloAtual,
    kpis,
    serieFaturamento,
    serieOrdens,
    servicosMaisRealizados,
    mediaDiaria,
    faturamentoOrigem,
    temPeriodoAnteriorComDados,
    // Período com OS, ou só com entradas lançadas no Financeiro.
    temDadosNoPeriodo: atual.ordens > 0 || atual.faturamento > 0,
    recarregar: carregar,
  };
}

function contarDiasEntre(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

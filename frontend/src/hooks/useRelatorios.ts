import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import type { OrdemRow } from '../types/dashboard';
import type { FiltroPeriodo, KpisRelatorio, MediaDiaria } from '../types/relatorios';
import {
  apenasFinalizadas,
  buildSeedOrdens,
  calcularServicosMaisRealizados,
  calcularVariacao,
  filtrarPorIntervalo,
  formatarMes,
  montarSerieTemporal,
  resolverIntervalo,
  resolverIntervaloAnterior,
  valorOS,
} from '../utils/relatorios';

const FILTRO_PADRAO: FiltroPeriodo = { preset: 'ultimos_30_dias' };

export function useRelatorios() {
  const [ordens, setOrdens] = useState<OrdemRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [usandoDadosDemo, setUsandoDadosDemo] = useState(false);
  const [filtro, setFiltro] = useState<FiltroPeriodo>(FILTRO_PADRAO);

  // Busca a lista completa de ordens uma única vez — sem paginação/filtro no
  // backend, igual ao padrão já usado na Visão Geral (useDashboard.ts).
  // Todo filtro e agrupamento por período acontece no cliente a partir daqui.
  //
  // Se a chamada falhar, cai para dados de demonstração — mas só em
  // desenvolvimento (import.meta.env.DEV). É o mesmo padrão de
  // useVeiculos/useClientes/useAgendamentos, com uma diferença de propósito:
  // aqui é faturamento de verdade, então em produção um backend fora do ar
  // continua mostrando o erro real em vez de números fictícios — isso é só
  // uma facilidade pra testar a tela localmente sem precisar do Supabase
  // configurado. Uma resposta bem sucedida com lista vazia (Supabase sem OS
  // ainda) nunca é substituída por dados falsos, em nenhum ambiente.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados: OrdemRow[] = await api.listarOrdens();
      setOrdens(dados);
      setUsandoDadosDemo(false);
    } catch {
      if (import.meta.env.DEV) {
        setOrdens(buildSeedOrdens());
        setUsandoDadosDemo(true);
      } else {
        setErro('Não foi possível carregar as ordens de serviço.');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const intervaloAtual = useMemo(
    () => resolverIntervalo(filtro.preset, filtro.personalizado),
    [filtro]
  );
  const intervaloAnterior = useMemo(
    () => resolverIntervaloAnterior(filtro.preset, intervaloAtual),
    [filtro.preset, intervaloAtual]
  );

  const ordensNoPeriodo = useMemo(() => filtrarPorIntervalo(ordens, intervaloAtual), [ordens, intervaloAtual]);
  const ordensPeriodoAnterior = useMemo(
    () => filtrarPorIntervalo(ordens, intervaloAnterior),
    [ordens, intervaloAnterior]
  );

  const finalizadasNoPeriodo = useMemo(() => apenasFinalizadas(ordensNoPeriodo), [ordensNoPeriodo]);
  const finalizadasPeriodoAnterior = useMemo(
    () => apenasFinalizadas(ordensPeriodoAnterior),
    [ordensPeriodoAnterior]
  );

  const temPeriodoAnteriorComDados = ordensPeriodoAnterior.length > 0;

  const kpis: KpisRelatorio = useMemo(() => {
    const faturamentoAtual = finalizadasNoPeriodo.reduce((s, o) => s + valorOS(o), 0);
    const faturamentoAnterior = temPeriodoAnteriorComDados
      ? finalizadasPeriodoAnterior.reduce((s, o) => s + valorOS(o), 0)
      : null;

    const qtdAtual = ordensNoPeriodo.length;
    const qtdAnterior = temPeriodoAnteriorComDados ? ordensPeriodoAnterior.length : null;

    const qtdFinalizadasAtual = finalizadasNoPeriodo.length;
    const qtdFinalizadasAnterior = temPeriodoAnteriorComDados ? finalizadasPeriodoAnterior.length : null;

    // Ticket médio = faturamento ÷ OS finalizadas — mesma população usada no
    // faturamento, para o número continuar significando "valor médio por
    // serviço concluído" (dividir pelo total de OS, incluindo as ainda em
    // andamento, distorceria a média para baixo).
    const ticketAtual = qtdFinalizadasAtual > 0 ? faturamentoAtual / qtdFinalizadasAtual : 0;
    const ticketAnterior =
      !temPeriodoAnteriorComDados
        ? null
        : qtdFinalizadasAnterior && qtdFinalizadasAnterior > 0 && faturamentoAnterior !== null
        ? faturamentoAnterior / qtdFinalizadasAnterior
        : 0;

    return {
      faturamento: {
        atual: faturamentoAtual,
        anterior: faturamentoAnterior,
        variacaoPercentual: calcularVariacao(faturamentoAtual, faturamentoAnterior),
      },
      ordensServico: {
        atual: qtdAtual,
        anterior: qtdAnterior,
        variacaoPercentual: calcularVariacao(qtdAtual, qtdAnterior),
      },
      ticketMedio: {
        atual: ticketAtual,
        anterior: ticketAnterior,
        variacaoPercentual: calcularVariacao(ticketAtual, ticketAnterior),
      },
    };
  }, [
    finalizadasNoPeriodo,
    finalizadasPeriodoAnterior,
    ordensNoPeriodo,
    ordensPeriodoAnterior,
    temPeriodoAnteriorComDados,
  ]);

  const serieFaturamento = useMemo(
    () =>
      montarSerieTemporal(
        finalizadasNoPeriodo,
        finalizadasPeriodoAnterior,
        intervaloAtual,
        intervaloAnterior,
        valorOS
      ),
    [finalizadasNoPeriodo, finalizadasPeriodoAnterior, intervaloAtual, intervaloAnterior]
  );

  const serieOrdens = useMemo(
    () =>
      montarSerieTemporal(ordensNoPeriodo, ordensPeriodoAnterior, intervaloAtual, intervaloAnterior, () => 1),
    [ordensNoPeriodo, ordensPeriodoAnterior, intervaloAtual, intervaloAnterior]
  );

  const servicosMaisRealizados = useMemo(
    () => calcularServicosMaisRealizados(finalizadasNoPeriodo),
    [finalizadasNoPeriodo]
  );

  // Média diária só é exibida em comparações mensais (este mês / mês
  // passado), onde meses de tamanhos diferentes tornam o total bruto
  // enganoso — ex.: abril (30 dias) parecer "mais fraco" que março (31)
  // mesmo tendo desempenho diário melhor.
  const mediaDiaria: MediaDiaria | null = useMemo(() => {
    if (filtro.preset !== 'este_mes' && filtro.preset !== 'mes_passado') return null;

    const diasAtual = Math.max(1, contarDiasEntre(intervaloAtual.inicio, intervaloAtual.fim));
    const atual = {
      total: ordensNoPeriodo.length,
      dias: diasAtual,
      media: ordensNoPeriodo.length / diasAtual,
      rotulo: formatarMes(intervaloAtual.inicio),
    };

    if (!temPeriodoAnteriorComDados) return { atual, anterior: null };

    const diasAnterior = Math.max(1, contarDiasEntre(intervaloAnterior.inicio, intervaloAnterior.fim));
    const anterior = {
      total: ordensPeriodoAnterior.length,
      dias: diasAnterior,
      media: ordensPeriodoAnterior.length / diasAnterior,
      rotulo: formatarMes(intervaloAnterior.inicio),
    };

    return { atual, anterior };
  }, [filtro.preset, intervaloAtual, intervaloAnterior, ordensNoPeriodo, ordensPeriodoAnterior, temPeriodoAnteriorComDados]);

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
    temDadosNoPeriodo: ordensNoPeriodo.length > 0,
    recarregar: carregar,
  };
}

function contarDiasEntre(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

import { useEffect, useMemo } from 'react';
import { MobileNav, MobileSafeTop } from '../Navigation';
import { DesktopShell } from '../../../components/DesktopShell';
import { useDestaqueAoChegar } from '../../../hooks/useDestaqueAoChegar';
import type { Destaque } from '../../../utils/destaque';
import { useRelatorios } from '../../../hooks/useRelatorios';
import { useEstoque } from '../../../hooks/useEstoque';
import { itensMaisMovimentados } from '../../../utils/estoque_utils';
import type { NavPage } from '../../../types/dashboard';
import { RelatoriosDesktop } from './relatoriosDesktop';
import { RelatoriosMobile } from './relatoriosMobile';

interface RelatoriosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  onGoToEstoque?: (focus: { search?: string }) => void;
  /** Veio de um card da Visão Geral: pulsa o(s) elemento(s) correspondente(s) ao chegar. */
  destaque?: Destaque | null;
  onDestaqueConcluido?: () => void;
}

export function RelatoriosPage({
  onNav,
  isMobile: mobile,
  onNewOS,
  onGoToEstoque,
  destaque,
  onDestaqueConcluido,
}: RelatoriosPageProps) {
  const {
    carregando,
    erro,
    filtro,
    setFiltro,
    intervaloAtual,
    kpis,
    serieFaturamento,
    serieOrdens,
    servicosMaisRealizados,
    mediaDiaria,
    faturamentoOrigem,
    temDadosNoPeriodo,
    recarregar,
  } = useRelatorios();

  // Reaproveita o mesmo intervaloAtual de Relatórios, só que sobre o log de
  // movimentação do Estoque em vez de sobre ordens — soma quantidade de
  // saída por item (aplicação de kit / uso avulso; ajustes manuais de
  // cadastro não contam, ver hooks/useEstoque.ts).
  const { itens: itensEstoque, movimentos: movimentosEstoque, carregando: carregandoEstoque } = useEstoque();
  const itensEstoqueMovimentados = useMemo(
    () => itensMaisMovimentados(movimentosEstoque, itensEstoque, intervaloAtual),
    [movimentosEstoque, itensEstoque, intervaloAtual]
  );

  // Destaque de chegada: espera os dados aparecerem. Se a tela terminou de carregar mas não
  // vai mostrar os blocos (erro / sem dados no período), cancela em vez de pulsar tarde demais.
  const conteudoPronto = !carregando && !erro && temDadosNoPeriodo;
  useDestaqueAoChegar(destaque, conteudoPronto, onDestaqueConcluido);
  useEffect(() => {
    if (destaque && !carregando && !conteudoPronto) onDestaqueConcluido?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destaque, carregando, conteudoPronto]);

  // ── layout mobile (redesign) ──────────────────────────────────────────────

  if (mobile) {
    return (
      <div
        style={{
          background: 'var(--color-bg)',
          minHeight: '100dvh',
          paddingBottom: 'var(--mobile-bottom-nav-h)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MobileSafeTop />
        <RelatoriosMobile
          carregando={carregando}
          carregandoEstoque={carregandoEstoque}
          erro={erro}
          filtro={filtro}
          onFiltroChange={setFiltro}
          intervaloAtual={intervaloAtual}
          kpis={kpis}
          serieFaturamento={serieFaturamento}
          serieOrdens={serieOrdens}
          servicosMaisRealizados={servicosMaisRealizados}
          itensEstoqueMovimentados={itensEstoqueMovimentados}
          mediaDiaria={mediaDiaria}
          faturamentoOrigem={faturamentoOrigem}
          temDadosNoPeriodo={temDadosNoPeriodo}
          onRecarregar={recarregar}
          onGoToEstoque={onGoToEstoque}
          onVoltar={() => onNav('dashboard')}
        />
        <MobileNav active='relatorios' onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
      </div>
    );
  }

  // ── layout desktop / laptop (redesign) ────────────────────────────────────

  return (
    <DesktopShell page='relatorios' onNav={onNav} onNewOS={onNewOS}>
      <RelatoriosDesktop
        carregando={carregando}
        carregandoEstoque={carregandoEstoque}
        erro={erro}
        filtro={filtro}
        onFiltroChange={setFiltro}
        intervaloAtual={intervaloAtual}
        kpis={kpis}
        serieFaturamento={serieFaturamento}
        serieOrdens={serieOrdens}
        servicosMaisRealizados={servicosMaisRealizados}
        itensEstoqueMovimentados={itensEstoqueMovimentados}
        mediaDiaria={mediaDiaria}
        faturamentoOrigem={faturamentoOrigem}
        temDadosNoPeriodo={temDadosNoPeriodo}
        onRecarregar={recarregar}
        onGoToEstoque={onGoToEstoque}
      />
    </DesktopShell>
  );
}
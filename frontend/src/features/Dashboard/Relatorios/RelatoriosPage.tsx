import { useMemo } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Sidebar, MobileNav } from '../Navigation';
import { Card, KpiCard, Skeleton } from '../Primitives';
import { useRelatorios } from '../../../hooks/useRelatorios';
import { useEstoque } from '../../../hooks/useEstoque';
import { formatBRL } from '../../../utils/dashboard';
import { formatarNumero } from '../../../utils/relatorios';
import { itensMaisMovimentados } from '../../../utils/estoque_utils';
import type { NavPage } from '../../../types/dashboard';

import { PeriodoSelector } from './PeriodoSelector';
import { FaturamentoComparativoChart } from './FaturamentoComparativoChart';
import { OrdensComparativoChart } from './OrdensComparativoChart';
import { ServicosMaisRealizadosChart } from './ServicosMaisRealizadosChart';
import { ItensEstoqueMaisMovimentadosChart } from './ItensEstoqueMaisMovimentadosChart';
import { MediaDiariaInfo } from './MediaDiariaInfo';

interface RelatoriosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
}

export function RelatoriosPage({ onNav, isMobile: mobile, onNewOS }: RelatoriosPageProps) {
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
    temDadosNoPeriodo,
    usandoDadosDemo,
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

  const sparkFaturamento = serieFaturamento.map((p) => p.atual ?? 0);
  const sparkOrdens = serieOrdens.map((p) => p.atual ?? 0);
  const sparkTicket = serieFaturamento.map((p, i) => {
    const qtd = serieOrdens[i]?.atual ?? 0;
    return qtd > 0 ? (p.atual ?? 0) / qtd : 0;
  });

  const chartHeight = mobile ? 220 : 260;

  // ── conteúdo ────────────────────────────────────────────────────────────────

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: mobile ? '14px 16px' : '16px 28px',
          background: 'white',
          borderBottom: `1px solid ${tokens.color.border}`,
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {mobile && (
            <button
              onClick={() => onNav('dashboard')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 4 }}
            >
              {Icons.chevL}
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontWeight: 800, fontSize: mobile ? '1.05rem' : '1.3rem', color: tokens.color.text, margin: 0 }}>
                Relatórios
              </h2>
              {usandoDadosDemo && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: tokens.color.warn,
                    background: tokens.color.warnBg,
                    border: `1px solid ${tokens.color.warnBorder}`,
                    borderRadius: 6,
                    padding: '2px 7px',
                  }}
                >
                  dados de demonstração
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              Desempenho, faturamento e operações da oficina.
            </p>
          </div>
        </div>
      </div>

      {/* período */}
      <PeriodoSelector filtro={filtro} intervaloAtual={intervaloAtual} isMobile={mobile} onChange={setFiltro} />

      {/* corpo */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: mobile ? '12px 12px 32px' : '18px 28px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {erro && !carregando && (
          <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: tokens.color.crit, display: 'flex' }}>{Icons.alert}</span>
              <span style={{ fontSize: '0.85rem', color: tokens.color.text }}>{erro}</span>
            </div>
            <button
              onClick={recarregar}
              style={{ padding: '7px 14px', background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
            >
              Tentar novamente
            </button>
          </Card>
        )}

        {!erro && !carregando && !temDadosNoPeriodo && (
          <Card style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: tokens.color.ferrariMid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.ferrari }}>
              {Icons.chart}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: tokens.color.text }}>Nenhuma ordem de serviço neste período</div>
            <div style={{ fontSize: '0.82rem', color: tokens.color.muted, maxWidth: 320 }}>
              Ainda não há dados suficientes para gerar relatórios no intervalo selecionado. Tente escolher um período maior.
            </div>
          </Card>
        )}

        {(carregando || (!erro && temDadosNoPeriodo)) && (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 14, flexDirection: mobile ? 'column' : 'row' }}>
              <KpiCard
                icon={Icons.dollar}
                title="Faturamento"
                value={formatBRL(kpis.faturamento.atual)}
                pct={kpis.faturamento.variacaoPercentual}
                spark={sparkFaturamento}
                loading={carregando}
                comparisonLabel="vs. período anterior"
              />
              <KpiCard
                icon={Icons.orders}
                title="Ordens de Serviço"
                value={`${formatarNumero(kpis.ordensServico.atual)} OS`}
                pct={kpis.ordensServico.variacaoPercentual}
                spark={sparkOrdens}
                loading={carregando}
                comparisonLabel="vs. período anterior"
              />
              <KpiCard
                icon={Icons.chart}
                title="Ticket Médio"
                value={formatBRL(kpis.ticketMedio.atual)}
                pct={kpis.ticketMedio.variacaoPercentual}
                spark={sparkTicket}
                loading={carregando}
                comparisonLabel="vs. período anterior"
              />
            </div>

            {mediaDiaria && <MediaDiariaInfo mediaDiaria={mediaDiaria} />}

            {/* gráficos principais */}
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <Card style={{ padding: mobile ? '16px' : '20px 24px' }}>
                <div className="dashboard-card__header">
                  <div>
                    <div className="dashboard-card__header-title">FATURAMENTO</div>
                    <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>
                      Valor estimado das OS finalizadas, por período, comparado ao período anterior.
                    </div>
                  </div>
                </div>
                {carregando ? <Skeleton h={chartHeight} r={8} /> : <FaturamentoComparativoChart dados={serieFaturamento} height={chartHeight} />}
              </Card>

              <Card style={{ padding: mobile ? '16px' : '20px 24px' }}>
                <div className="dashboard-card__header">
                  <div>
                    <div className="dashboard-card__header-title">ORDENS DE SERVIÇO</div>
                    <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>
                      Quantidade de OS abertas por período, comparado ao período anterior.
                    </div>
                  </div>
                </div>
                {carregando ? <Skeleton h={chartHeight} r={8} /> : <OrdensComparativoChart dados={serieOrdens} height={chartHeight} />}
              </Card>
            </div>

            {/* serviços mais realizados */}
            <Card style={{ padding: mobile ? '16px' : '20px 24px' }}>
              <div className="dashboard-card__header">
                <div>
                  <div className="dashboard-card__header-title">SERVIÇOS MAIS REALIZADOS</div>
                  <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>
                    Serviços mais frequentes entre as OS finalizadas no período (quantidade e % do total).
                  </div>
                </div>
                <span style={{ color: tokens.color.muted, display: 'flex' }}>{Icons.wrench}</span>
              </div>
              {carregando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} h={26} />
                  ))}
                </div>
              ) : servicosMaisRealizados.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: tokens.color.muted, textAlign: 'center', padding: '20px 0' }}>
                  Nenhum serviço registrado em OS finalizadas neste período.
                </div>
              ) : (
                <ServicosMaisRealizadosChart dados={servicosMaisRealizados} />
              )}
            </Card>

            {/* itens de estoque mais movimentados */}
            <Card style={{ padding: mobile ? '16px' : '20px 24px' }}>
              <div className="dashboard-card__header">
                <div>
                  <div className="dashboard-card__header-title">ITENS DE ESTOQUE MAIS MOVIMENTADOS</div>
                  <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>
                    Peças com mais saída de estoque no período (quantidade e % do total).
                  </div>
                </div>
                <span style={{ color: tokens.color.muted, display: 'flex' }}>{Icons.box}</span>
              </div>
              {carregando || carregandoEstoque ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} h={26} />
                  ))}
                </div>
              ) : itensEstoqueMovimentados.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: tokens.color.muted, textAlign: 'center', padding: '20px 0' }}>
                  Nenhuma movimentação de estoque neste período.
                </div>
              ) : (
                <ItensEstoqueMaisMovimentadosChart dados={itensEstoqueMovimentados} />
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );

  // ── layout ──────────────────────────────────────────────────────────────────

  if (mobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="relatorios" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="relatorios" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {content}
      </main>
    </div>
  );
}

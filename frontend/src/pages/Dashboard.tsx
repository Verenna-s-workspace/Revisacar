import { useMemo, useState } from 'react';
import '../styles/dashboard.css';
import { tokens } from '../constants';
import { useResponsive } from '../components/ui';
import { useOrdens } from '../hooks/useOrdens';
import { useVisaoGeral } from '../hooks/useVisaoGeral';
import { useAlertasResumo } from '../hooks/useAlertasResumo';
import { formatBRL, HEAT_DAYS } from '../utils/dashboard';
import { calcularVariacao } from '../utils/relatorios';
import {
  ORDEM_TOP_SERVICOS, PERIODOS_GRAFICO, limitarPct, serieDoPeriodo, topServicos as ordenarTopServicos,
  type OrdemTopServicos, type PeriodoGrafico,
} from '../utils/visao_geral';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useAuth } from '../context/AuthContext';

// Components
import { Sidebar, DesktopHeader, MobileTopbar, MobileNav, NAV_ITEMS } from '../features/Dashboard/Navigation';
import { KpiCard, MetaCard, Card, Skeleton, ProgressBar, HeatmapRow } from '../features/Dashboard/Primitives';
import { Icons, SVC_ICON } from '../features/Dashboard/Icons';
import { FaturamentoChart } from '../features/Dashboard/FaturamentoChart';
import { Select } from '../components/inputs/select';
import { OSRow, OSModal, OrdensPage } from '../features/Dashboard/OrdensPage';

// High-fidelity Sub-pages
import { ClientesPage } from '../features/Dashboard/Clientes/ClientesPage';
import { VeiculosPage } from '../features/Dashboard/Veiculos/VeiculosPage';
import { EstoquePage } from '../features/Dashboard/EstoquePage';
import { FinanceiroPage } from '../features/Dashboard/FinanceiroPage';
import { ConfiguracoesPage } from '../features/Dashboard/ConfiguracoesPage';
import { AgendamentosPage } from '../features/Dashboard/Agendamentos/AgendamentosPage';
import { ServicosPage } from '../features/Dashboard/ServicosPage';
import { RelatoriosPage } from '../features/Dashboard/Relatorios/RelatoriosPage';
import { AtendimentoPage } from '../features/Dashboard/Atendimento/AtendimentoPage';

// Types
import type { NavPage, OrdemRow } from '../types/dashboard';
import type { Alerta } from '../types/dashboard';
import type { OSPrefillInput } from '../types/atendimento';

// ── PlaceholderPage ───────────────────────────────────────────────────────────

function PlaceholderPage({ page, onNav, isMobile, onNewOS }: { page: NavPage; onNav: (p: NavPage) => void; isMobile: boolean; onNewOS: () => void }) {
  const nav = NAV_ITEMS.find(n => n.id === page);
  const content = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(204,20,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CC1400' }}>{nav?.icon}</div>
      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: tokens.color.text }}>{nav?.label}</div>
      <div style={{ color: tokens.color.muted, fontSize: '0.87rem', textAlign: 'center', maxWidth: 280 }}>Esta tela está em desenvolvimento.</div>
      <button onClick={() => onNav('dashboard')} style={{ padding: '10px 22px', background: '#CC1400', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>← Dashboard</button>
    </div>
  );
  if (isMobile) return (
    <div style={{ background: tokens.color.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <MobileTopbar active={page} onNav={onNav} />{content}<MobileNav active={page} onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={page} onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{content}</main>
    </div>
  );
}

// ── ShellPage ──────────────────────────────────────────────────────────────
// Pra páginas "sem chrome própria" (FinanceiroPage, ConfiguracoesPage — só
// devolvem o conteúdo interno, sem Sidebar/topbar). Reaproveita a mesma casca
// da PlaceholderPage, mas com o conteúdo real no lugar do placeholder.

function ShellPage({ page, onNav, isMobile, onNewOS, children }: { page: NavPage; onNav: (p: NavPage) => void; isMobile: boolean; onNewOS: () => void; children: React.ReactNode }) {
  if (isMobile) return (
    <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      <MobileTopbar active={page} onNav={onNav} />
      <div style={{ padding: '16px 14px 32px' }}>{children}</div>
      <MobileNav active={page} onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={page} onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <DesktopHeader onNav={onNav} />
        <div style={{ padding: '18px 28px 32px' }}>{children}</div>
      </main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard({ onNewOS, onLoadOS, onNewOSComPrefill, onOpenLearningCenter }: { onNewOS: () => void; onLoadOS?: (id: string) => void; onNewOSComPrefill?: (prefill: OSPrefillInput) => void; onOpenLearningCenter?: () => void }) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const { ordens, loading: ordensLoading, erro: ordensErro } = useOrdens();
  const { dados: vg, loading, erro: vgErro, recarregar: recarregarVg, salvarMeta } = useVisaoGeral();
  const alertasResumo = useAlertasResumo();
  const [page, setPage] = useState<NavPage>('dashboard');
  const [sel, setSel] = useState<OrdemRow | null>(null);
  // Período do gráfico e critério do Top Serviços: recortam/ordenam os dados que
  // o servidor já mandou (série de 31 dias, serviços dos últimos 30).
  const [periodoGrafico, setPeriodoGrafico] = useState<PeriodoGrafico>('Últimos 7 dias');
  const [ordemTopServicos, setOrdemTopServicos] = useState<OrdemTopServicos>('Por faturamento');
  // Foco pendente para a tela de Agendamentos (definido ao navegar a partir da
  // badge "Agendado" ou da aba Agendamentos no perfil de um cliente). Qualquer
  // navegação "normal" (sidebar, menu mobile, botão voltar) passa por
  // `handleNav` e limpa esse foco, para que ele nunca "vaze" para uma visita
  // posterior e não relacionada à tela de Agendamentos.
  const [agendaFocus, setAgendaFocus] = useState<{ search?: string; highlightId?: string } | null>(null);
  // Mesmo mecanismo, agora para o Estoque — usado pelo card "Destaque do Período"
  // em Relatórios pra abrir o Estoque já com a busca preenchida no item clicado.
  const [estoqueFocus, setEstoqueFocus] = useState<{ search?: string } | null>(null);

  // Hooks SEMPRE antes dos `return` antecipados das outras páginas (senão trocar
  // de página muda a quantidade de hooks → React error #300).
  const comDinheiro = !!vg?.faturamento;
  const serieGrafico = useMemo(
    () => (vg ? serieDoPeriodo(vg.serie, vg.hoje, periodoGrafico, comDinheiro) : []),
    [vg, periodoGrafico, comDinheiro]
  );
  const topServicosLista = useMemo(
    () => (vg ? ordenarTopServicos(vg.servicos, ordemTopServicos, comDinheiro) : []),
    [vg, ordemTopServicos, comDinheiro]
  );

  const handleNav = (p: NavPage) => {
    if (p === 'dicas') { onOpenLearningCenter?.(); return; }
    setAgendaFocus(null); setEstoqueFocus(null); setPage(p);
  };
  const handleGoToAgendamentos = (focus: { search?: string; highlightId?: string }) => {
    setAgendaFocus(focus);
    setPage('agendamentos');
  };
  const handleGoToEstoque = (focus: { search?: string }) => {
    setEstoqueFocus(focus);
    setPage('estoque');
  };

  if (page === 'ordens') {
    return <OrdensPage ordens={ordens} loading={ordensLoading} onNewOS={onNewOS} onLoadOS={onLoadOS} onNav={handleNav} isMobile={isMobile} />;
  }
  if (page === 'atendimento') {
    return (
      <AtendimentoPage
        onNav={handleNav}
        isMobile={isMobile}
        onNewOS={onNewOS}
        onLoadOS={onLoadOS}
        onNewOSComPrefill={onNewOSComPrefill}
      />
    );
  }
  if (page === 'agendamentos') {
    return (
      <AgendamentosPage
        onNav={handleNav}
        isMobile={isMobile}
        onNewOS={onNewOS}
        initialSearch={agendaFocus?.search}
        initialHighlightId={agendaFocus?.highlightId}
      />
    );
  }
  if (page === 'veiculos') {
    return <VeiculosPage onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} />;
  }
  if (page === 'estoque') {
    return (
      <EstoquePage
        onNav={handleNav}
        isMobile={isMobile}
        onNewOS={onNewOS}
        initialSearch={estoqueFocus?.search}
      />
    );
  }
  if (page === 'clientes') {
    return (
      <ClientesPage
        onNav={handleNav}
        isMobile={isMobile}
        onNewOS={onNewOS}
        onLoadOS={onLoadOS}
        onGoToAgendamentos={handleGoToAgendamentos}
      />
    );
  }
  if (page === 'servicos') {
    return <ServicosPage onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} />;
  }
  if (page === 'relatorios') {
    return (
      <RelatoriosPage
        onNav={handleNav}
        isMobile={isMobile}
        onNewOS={onNewOS}
        onGoToEstoque={handleGoToEstoque}
      />
    );
  }
  if (page === 'financeiro') {
    return (
      <ShellPage page={page} onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS}>
        <FinanceiroPage isMobile={isMobile} />
      </ShellPage>
    );
  }
  if (page === 'configuracoes') {
    return (
      <ShellPage page={page} onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS}>
        <ConfiguracoesPage isMobile={isMobile} />
      </ShellPage>
    );
  }
  if (page !== 'dashboard') {
    return <PlaceholderPage page={page} onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} />;
  }

  // ── Dados da Visão Geral (vêm prontos do servidor) ────────────────────────
  // Falhou de verdade (e não está carregando): esconde os blocos que dependem
  // desses números e mostra o erro com "tentar novamente" — nunca zeros fictícios.
  const semDados = !loading && !vg;
  const fat = vg?.faturamento;                 // só existe pra quem pode ver dinheiro
  const fin = vg?.financeiro;

  const spark7Fat = (vg?.serie ?? []).slice(-7).map(d => d.faturamento ?? 0);
  const spark7Os = (vg?.serie ?? []).slice(-7).map(d => Math.max(d.ordens, 1));

  const erroCard = vgErro && !loading ? (
    <Card style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: tokens.color.crit, display: 'flex' }}>{Icons.alert}</span>
        <span style={{ fontSize: '0.85rem', color: tokens.color.text }}>{vgErro}</span>
      </div>
      <button
        onClick={recarregarVg}
        style={{ padding: '7px 14px', background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
      >
        Tentar novamente
      </button>
    </Card>
  ) : null;

  // ── KPI Row ────────────────────────────────────────────────────────────────
  // "Faturamento do mês": mês corrente até hoje × MESMO trecho do mês anterior.
  const kpiRow = semDados ? null : (
    <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
      {(loading || fat) && (
        <KpiCard
          icon={Icons.dollar}
          title="Faturamento do mês"
          value={formatBRL(fat?.atual ?? 0)}
          pct={fat ? calcularVariacao(fat.atual, fat.anterior) : null}
          spark={spark7Fat}
          loading={loading}
        />
      )}
      <KpiCard
        icon={Icons.orders}
        title="Ordens de Serviço"
        value={(vg?.ordens.atual ?? 0).toLocaleString('pt-BR')}
        pct={vg ? calcularVariacao(vg.ordens.atual, vg.ordens.anterior) : null}
        spark={spark7Os}
        loading={loading}
      />
      {(loading || vg?.meta) && (
        <MetaCard
          meta={vg?.meta?.valor ?? null}
          alcancado={fat?.atual ?? 0}
          editavel={vg?.meta?.editavel ?? false}
          onSalvar={salvarMeta}
          loading={loading}
        />
      )}
    </div>
  );

  // ── Chart Section ──────────────────────────────────────────────────────────
  const chartSection = semDados ? null : (
    <Card style={{ padding: isMobile ? '16px' : '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>
            {comDinheiro || loading ? 'ANÁLISE DE FATURAMENTO' : 'ORDENS POR DIA'}
          </div>
          {!isMobile && (
            <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>
              {comDinheiro || loading
                ? (fat?.origem === 'estimado' ? 'Faturamento estimado (R$) — sem entradas no Financeiro' : 'Faturamento (R$)')
                : 'Ordens de serviço abertas'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && serieGrafico.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: tokens.color.muted }}>
              <span style={{ display: 'flex' }}>{Icons.cal}</span>
              {serieGrafico[0].dia} – {serieGrafico[serieGrafico.length - 1].dia}, {new Date().getFullYear()}
            </div>
          )}
          <div style={{ width: 155 }}>
            <Select
              name="dash_periodo_faturamento"
              value={periodoGrafico}
              onChangeValue={(v: string) => setPeriodoGrafico(v as PeriodoGrafico)}
              options={[...PERIODOS_GRAFICO]}
            />
          </div>
        </div>
      </div>
      {loading
        ? <Skeleton h={isMobile ? 160 : 220} r={8} />
        : <FaturamentoChart data={serieGrafico} height={isMobile ? 160 : 220} formato={comDinheiro ? 'moeda' : 'numero'} />
      }
    </Card>
  );

  // ── Top Serviços ───────────────────────────────────────────────────────────
  // OS finalizadas dos últimos 30 dias. O valor é ESTIMADO (preço por tipo de
  // serviço × quantidade), não faturamento real — por isso "est." no cabeçalho.
  const topServicosSection = semDados ? null : (
    <Card style={{ padding: isMobile ? '16px' : '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="dashboard-card__header-title">TOP SERVIÇOS</div>
          <div style={{ fontSize: '0.68rem', color: tokens.color.muted, marginTop: 2 }}>OS finalizadas nos últimos 30 dias</div>
        </div>
        {comDinheiro && (
          <div style={{ width: 160 }}>
            <Select
              name="dash_ordenar_top_servicos"
              value={ordemTopServicos}
              onChangeValue={(v: string) => setOrdemTopServicos(v as OrdemTopServicos)}
              options={[...ORDEM_TOP_SERVICOS]}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${tokens.color.border}` }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Serviço</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em', width: 72, textAlign: 'right' }}>
            {comDinheiro ? 'Fat. est. (R$)' : 'Qtd.'}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {HEAT_DAYS.map(d => (
              <div key={d} style={{ width: 18, fontSize: '0.6rem', textAlign: 'center', color: tokens.color.muted, fontWeight: 600 }}>{d}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={22} />)
          : topServicosLista.length === 0
            ? <div style={{ fontSize: '0.82rem', color: tokens.color.muted, textAlign: 'center', padding: '14px 0' }}>Nenhum serviço finalizado nos últimos 30 dias.</div>
            : topServicosLista.map(s => (
              <div key={s.nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(204,20,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CC1400', flexShrink: 0 }}>
                  {SVC_ICON[s.nome] ?? Icons.wrench}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.84rem', fontWeight: 500, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nome}</div>
                </div>
                <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond, width: 72, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>
                  {comDinheiro
                    ? (s.valorEstimado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : s.quantidade.toLocaleString('pt-BR')}
                </div>
                <HeatmapRow heatmap={s.semana} />
              </div>
            ))
        }
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: `1px solid ${tokens.color.border}` }}>
        <span style={{ fontSize: '0.68rem', color: tokens.color.muted }}>Menor</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0.07, 0.18, 0.32, 0.5, 0.72, 0.9].map((o, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: `rgba(204,20,0,${o})` }} />
          ))}
        </div>
        <span style={{ fontSize: '0.68rem', color: tokens.color.muted }}>Maior</span>
      </div>
    </Card>
  );

  // ── Resumo Financeiro ──────────────────────────────────────────────────────
  // Só pra quem tem financeiro.ver (o servidor omite o bloco). Receitas/custos
  // são os lançamentos do Financeiro no mês; lucro só pro dono (ver_margem).
  const financeChartData = fin
    ? [
        { name: 'Receitas', value: fin.receitas, color: '#CC1400' },
        { name: 'Custos', value: fin.despesas, color: '#D4A020' },
        ...(fin.lucro !== undefined ? [{ name: 'Lucro Líquido', value: fin.lucro, color: '#1A7F4B' }] : []),
      ]
    : [];

  const revenueBase = Math.max(fin?.receitas ?? 0, 1);
  const financeRows = financeChartData.map(row => ({
    ...row,
    pct: row.name === 'Receitas' ? 100 : Math.round((row.value / revenueBase) * 100),
  }));

  const resumoFinanceiro = !loading && !fin ? null : (
    <Card style={{ padding: '20px 22px' }}>
      <div className="dashboard-card__header">
        <div className="dashboard-card__header-title">RESUMO FINANCEIRO</div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          <Skeleton h={22} />
          <Skeleton h={22} />
          <Skeleton h={22} />
          <Skeleton h={140} />
        </div>
      ) : fin && !fin.temLancamentos ? (
        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: '0.82rem', color: tokens.color.muted, lineHeight: 1.5 }}>
          Ainda não há entradas nem saídas lançadas no Financeiro neste período.
          <div style={{ marginTop: 10 }}>
            <button onClick={() => handleNav('financeiro')} style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              Ir para o Financeiro →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height: 190, marginBottom: 18 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeChartData} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.color.border} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: tokens.color.muted }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={10}
                />
                <Tooltip
                  formatter={(value: number) => formatBRL(value)}
                  cursor={{ fill: 'rgba(204,20,0,0.08)' }}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {financeChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={(value: number) => formatBRL(value)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {financeRows.map(row => (
            <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond, width: 96, flexShrink: 0 }}>{row.name}</span>
              <ProgressBar pct={limitarPct(row.pct)} color={row.color} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tokens.color.text, width: 90, textAlign: 'right', flexShrink: 0 }}>{formatBRL(row.value)}</span>
              <span style={{ fontSize: '0.7rem', color: tokens.color.muted, width: 36, flexShrink: 0 }}>{row.pct}%</span>
            </div>
          ))}

          {fin?.lucroVariacaoPercentual !== undefined && (
            <div style={{ marginTop: 6, padding: '10px 13px', background: '#EFF8FF', borderRadius: 9, border: '1px solid #BAE0FD', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span style={{ color: '#1565C0', flexShrink: 0, marginTop: 1, display: 'flex' }}>{Icons.info}</span>
              <span style={{ fontSize: '0.77rem', color: '#1565C0', lineHeight: 1.5 }}>
                Seu lucro líquido {fin.lucroVariacaoPercentual >= 0 ? 'aumentou' : 'diminuiu'}{' '}
                {Math.abs(fin.lucroVariacaoPercentual).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% em relação ao mesmo trecho do mês anterior.
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );

  // ── Ordens Recentes ────────────────────────────────────────────────────────
  const ordensRecentes = (
    <Card style={{ padding: isMobile ? '14px 16px' : '18px 20px' }}>
      <div className="dashboard-card__header">
        <div className="dashboard-card__header-title">ORDENS RECENTES</div>
        <button onClick={() => setPage('ordens')} style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
          Ver todas
        </button>
      </div>
      {ordensLoading
        ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: `1px solid ${tokens.color.border}` }}>
            <Skeleton h={58} r={8} />
          </div>
        ))
        : ordens.slice(0, 3).map(o => <OSRow key={o.id} ordem={o} onClick={() => setSel(o)} />)
      }
      {!ordensLoading && ordensErro && (
        <div className="dashboard-orders-empty">{ordensErro}</div>
      )}
      {!ordensLoading && !ordensErro && ordens.length === 0 && (
        <div className="dashboard-orders-empty">Nenhuma ordem ainda</div>
      )}
    </Card>
  );

  // ── Alertas ────────────────────────────────────────────────────────────────
  // Os mesmos alertas reais da sidebar (useAlertasResumo): OS bloqueadas, clientes
  // a avisar, estoque baixo e itens em quarentena. Antes eram frases fixas
  // (ex.: "aguardando aprovação" contava rascunhos).
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const alertasLista: Alerta[] = [
    ...(alertasResumo.bloqueados > 0 ? [{ tipo: 'crit' as const, msg: `${plural(alertasResumo.bloqueados, 'ordem bloqueada', 'ordens bloqueadas')}`, detalhe: 'Aguardando liberação' }] : []),
    ...(alertasResumo.clientesNaoAvisados > 0 ? [{ tipo: 'warn' as const, msg: `${plural(alertasResumo.clientesNaoAvisados, 'cliente', 'clientes')} para avisar`, detalhe: 'Serviço finalizado hoje' }] : []),
    ...(alertasResumo.baixoEstoque > 0 ? [{ tipo: 'crit' as const, msg: `${plural(alertasResumo.baixoEstoque, 'item com estoque baixo', 'itens com estoque baixo')}`, detalhe: '' }] : []),
    ...(alertasResumo.quarentena > 0 ? [{ tipo: 'warn' as const, msg: `${plural(alertasResumo.quarentena, 'item em quarentena', 'itens em quarentena')}`, detalhe: '' }] : []),
  ];
  // O card inteiro e o último item da lista navegam para Atendimento (ainda a
  // única tela com detalhe de alertas — ver mesmo padrão em Sidebar/alertas).
  const alertasSection = (
    <Card
      onClick={() => handleNav('atendimento')}
      style={{ padding: isMobile ? '14px 16px' : '18px 20px', cursor: 'pointer' }}
    >
      <div className="dashboard-card__header" style={{ marginBottom: 12 }}>
        <div className="dashboard-card__header-title">ALERTAS IMPORTANTES</div>
        <button onClick={(e) => e.stopPropagation()} style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Ver todas</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alertasResumo.loading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} h={46} r={10} />)}
        {!alertasResumo.loading && alertasLista.length === 0 && (
          <div style={{ padding: '14px 13px', borderRadius: 10, background: '#F0FAF4', border: '1px solid rgba(26,127,75,0.18)', fontSize: '0.84rem', fontWeight: 600, color: '#1A7F4B' }}>
            Nenhum alerta no momento
          </div>
        )}
        {!alertasResumo.loading && alertasLista.map((a, i) => {
          const cfg = {
            crit: { bg: '#FFF0EE', border: 'rgba(204,20,0,0.18)', color: '#CC1400', icon: Icons.alert },
            warn: { bg: '#FFF8EC', border: 'rgba(179,92,0,0.18)', color: '#B35C00', icon: Icons.clock },
            info: { bg: '#F0FAF4', border: 'rgba(26,127,75,0.18)', color: '#1A7F4B', icon: Icons.cal },
          }[a.tipo];
          const isUltimo = i === alertasLista.length - 1;
          return (
            <div
              key={i}
              onClick={isUltimo ? (e) => { e.stopPropagation(); handleNav('atendimento'); } : undefined}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: cfg.color, flexShrink: 0, marginTop: 1, display: 'flex' }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: tokens.color.text }}>{a.msg}</div>
                  {a.detalhe && <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>{a.detalhe}</div>}
                </div>
              </div>
              <span style={{ color: tokens.color.muted, flexShrink: 0, display: 'flex' }}>{Icons.arrow}</span>
            </div>
          );
      })}
      </div>
      {!isMobile && (
        <button
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', marginTop: 14, padding: '12px', background: '#CC1400', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          Ver Todos os Alertas →
        </button>
      )}
    </Card>
  );

  // ── Acessos Rápidos (mobile only) ─────────────────────────────────────────
  const acessosRapidos = (
    <Card style={{ padding: '16px' }}>
      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text, marginBottom: 10 }}>ACESSOS RÁPIDOS</div>
      {([
        { icon: Icons.orders, label: 'Ordens de Serviço', p: 'ordens' as NavPage },
        { icon: Icons.cal,    label: 'Agendamentos',      p: 'agendamentos' as NavPage },
        { icon: Icons.user,   label: 'Clientes',          p: 'clientes' as NavPage },
        { icon: Icons.car,    label: 'Veículos',          p: 'veiculos' as NavPage },
        { icon: Icons.box,    label: 'Estoque',           p: 'estoque' as NavPage },
      ]).map(item => (
        <button
          key={item.p}
          onClick={() => setPage(item.p)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 8px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `1px solid ${tokens.color.border}`, borderRadius: 6 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: tokens.color.text }}>
            <span style={{ color: tokens.color.muted, display: 'flex' }}>{item.icon}</span>
            <span style={{ fontSize: '0.875rem' }}>{item.label}</span>
          </div>
          <span style={{ color: tokens.color.muted, display: 'flex' }}>{Icons.arrow}</span>
        </button>
      ))}
    </Card>
  );

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      <MobileTopbar active={page} onNav={handleNav} />
      <div style={{ padding: '16px 14px 0' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: tokens.color.text, margin: '0 0 2px' }}>
          Olá{user?.nome ? `, ${user.nome}` : ''} 👋
        </h2>
        <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '0 0 16px' }}>Aqui está o desempenho da sua oficina hoje.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 14px' }}>
        {erroCard}
        {kpiRow}
        {chartSection}
        <div style={{ display: 'grid', gridTemplateColumns: topServicosSection ? '1fr 1fr' : '1fr', gap: 14 }}>
          {topServicosSection}
          {acessosRapidos}
        </div>
        {ordensRecentes}
        {alertasSection}
      </div>
      <MobileNav active={page} onNav={handleNav} onNewOS={onNewOS} />
      {sel && <OSModal ordem={sel} onClose={() => setSel(null)} onEdit={() => { onLoadOS?.(sel.id); setSel(null); }} />}
    </div>
  );

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: tokens.color.bg }}>
      <Sidebar active={page} onNav={handleNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <DesktopHeader onNav={handleNav} />
        <div style={{ padding: '18px 28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {erroCard}
          {kpiRow}
          {(chartSection || topServicosSection) && (
            <div style={{ display: 'grid', gridTemplateColumns: chartSection && topServicosSection ? '1fr 420px' : '1fr', gap: 18 }}>
              {chartSection}
              {topServicosSection}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: `${resumoFinanceiro ? '320px ' : ''}1fr 310px`, gap: 18 }}>
            {resumoFinanceiro}
            {ordensRecentes}
            {alertasSection}
          </div>
        </div>
      </main>
      {sel && <OSModal ordem={sel} onClose={() => setSel(null)} onEdit={() => { onLoadOS?.(sel.id); setSel(null); }} />}
    </div>
  );
}
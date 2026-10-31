import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/dashboard.css';
import { tokens } from '../constants';
import { useResponsive } from '../components/ui';
import { useOrdens } from '../hooks/useOrdens';
import { useVisaoGeral } from '../hooks/useVisaoGeral';
import { useAlertas } from '../hooks/useAlertas';
import { formatBRL, HEAT_DAYS } from '../utils/dashboard';
import { calcularVariacao } from '../utils/relatorios';
import {
  ORDEM_TOP_SERVICOS, PERIODOS_GRAFICO, limitarPct, serieDoPeriodo, topServicos as ordenarTopServicos,
  type OrdemTopServicos, type PeriodoGrafico,
} from '../utils/visao_geral';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { podeEditarConfiguracoes, sincronizarOficinaConfig } from '../utils/oficina_config';
import { preCarregarQuandoOcioso, telaSobDemanda } from '../utils/telaSobDemanda';

// Components
import { Sidebar, DesktopHeader, MobileTopbar, MobileNav, NAV_ITEMS } from '../features/Dashboard/Navigation';
import { KpiCard, MetaCard, Card, Skeleton, ProgressBar, HeatmapRow } from '../features/Dashboard/Primitives';
import { Icons, SVC_ICON } from '../features/Dashboard/Icons';
import { FaturamentoChart } from '../features/Dashboard/FaturamentoChart';
import { Select } from '../components/inputs/select';
import { OSRow, OSModal, OrdensPage } from '../features/Dashboard/OrdensPage';

// High-fidelity Sub-pages — cada uma num arquivo à parte, baixado quando abre ou em segundo plano
// depois que a Visão Geral aparece (ver utils/telaSobDemanda.ts).
const ClientesPage = telaSobDemanda(() => import('../features/Dashboard/Clientes/ClientesPage').then((m) => m.ClientesPage));
const VeiculosPage = telaSobDemanda(() => import('../features/Dashboard/Veiculos/VeiculosPage').then((m) => m.VeiculosPage));
const EstoquePage = telaSobDemanda(() => import('../features/Dashboard/EstoquePage').then((m) => m.EstoquePage));
const FinanceiroPage = telaSobDemanda(() => import('../features/Dashboard/FinanceiroPage').then((m) => m.FinanceiroPage));
const ConfiguracoesPage = telaSobDemanda(() => import('../features/Dashboard/ConfiguracoesPage').then((m) => m.ConfiguracoesPage));
const AgendamentosPage = telaSobDemanda(() => import('../features/Dashboard/Agendamentos/AgendamentosPage').then((m) => m.AgendamentosPage));
const ServicosPage = telaSobDemanda(() => import('../features/Dashboard/ServicosPage').then((m) => m.ServicosPage));
const RelatoriosPage = telaSobDemanda(() => import('../features/Dashboard/Relatorios/RelatoriosPage').then((m) => m.RelatoriosPage));
const AtendimentoPage = telaSobDemanda(() => import('../features/Dashboard/Atendimento/AtendimentoPage').then((m) => m.AtendimentoPage));
const AlertasPage = telaSobDemanda(() => import('../features/Dashboard/Alertas/AlertasPage').then((m) => m.AlertasPage));
const SUBPAGINAS = [AtendimentoPage, AgendamentosPage, AlertasPage, ClientesPage, VeiculosPage, EstoquePage,
  ServicosPage, FinanceiroPage, RelatoriosPage, ConfiguracoesPage];

// Types
import type { NavPage, OrdemRow } from '../types/dashboard';
import type { Alerta } from '../types/dashboard';
import type { OSPrefillInput } from '../types/atendimento';
import type { AcaoAlerta } from '../utils/alertas';

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
    <div style={{ background: tokens.color.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <MobileTopbar active={page} onNav={onNav} />{content}<MobileNav active={page} onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
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
    <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      <MobileTopbar active={page} onNav={onNav} />
      <div style={{ padding: '16px 14px 32px' }}>{children}</div>
      <MobileNav active={page} onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
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
  // isCompact (< 980px): celular, celular deitado, tablet e dobrável usam o
  // layout mobile. Antes só < 640px — o resto ganhava a sidebar de 240px.
  const { isCompact: isMobile } = useResponsive();
  const { ordens, loading: ordensLoading, erro: ordensErro } = useOrdens();
  const { dados: vg, loading, erro: vgErro, recarregar: recarregarVg, salvarMeta } = useVisaoGeral();
  const alertasResumo = useAlertas();
  const [page, setPagina] = useState<NavPage>('dashboard');
  // Em transição: se o arquivo da próxima tela ainda não chegou, a tela atual continua à mostra
  // (em vez de piscar "Carregando...") até ele chegar.
  const setPage = (p: NavPage) => startTransition(() => setPagina(p));
  // Esta tela fica montada enquanto se navega pelas outras páginas: sem isto,
  // lançamentos feitos no Financeiro (ou OS criadas) não apareciam aqui até
  // recarregar o navegador. Ao VOLTAR pra Visão Geral, busca de novo.
  const jaMontou = useRef(false);
  useEffect(() => {
    if (!jaMontou.current) { jaMontou.current = true; return; }
    if (page === 'dashboard') recarregarVg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  // Dados da oficina (horário da Agenda) vêm do servidor: atualiza a cópia local uma vez por
  // abertura, pra outro aparelho ver o que foi salvo em Configurações.
  useEffect(() => {
    void sincronizarOficinaConfig(podeEditarConfiguracoes(user));
    preCarregarQuandoOcioso(SUBPAGINAS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // Trocar de tela começa do topo: a rolagem é da página inteira (a sidebar é
  // sticky), então sem isto a tela nova abria no meio, na altura da anterior.
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

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

  // Clique num alerta: abre a tela de destino (Estoque já com a busca no item) ou a OS.
  const handleAcaoAlerta = (acao: AcaoAlerta) => {
    const d = acao.destino;
    if (d.tipo === 'ordem') { onLoadOS?.(d.ordemId); return; }
    if (d.page === 'estoque' && d.busca) { handleGoToEstoque({ search: d.busca }); return; }
    handleNav(d.page);
  };

  if (page === 'alertas') {
    return <AlertasPage onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} onAcao={handleAcaoAlerta} />;
  }
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
    return <VeiculosPage onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} onNewOSComPrefill={onNewOSComPrefill} />;
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
        onNewOSComPrefill={onNewOSComPrefill}
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
  const kpiItems = [
    (loading || fat) && (
      <KpiCard
        key="fat"
        icon={Icons.dollar}
        title="Faturamento do mês"
        value={formatBRL(fat?.atual ?? 0)}
        pct={fat ? calcularVariacao(fat.atual, fat.anterior) : null}
        spark={spark7Fat}
        loading={loading}
      />
    ),
    <KpiCard
      key="os"
      icon={Icons.orders}
      title="Ordens de Serviço"
      value={(vg?.ordens.atual ?? 0).toLocaleString('pt-BR')}
      pct={vg ? calcularVariacao(vg.ordens.atual, vg.ordens.anterior) : null}
      spark={spark7Os}
      loading={loading}
    />,
    (loading || vg?.meta) && (
      <MetaCard
        key="meta"
        meta={vg?.meta?.valor ?? null}
        alcancado={fat?.atual ?? 0}
        editavel={vg?.meta?.editavel ?? false}
        onSalvar={salvarMeta}
        loading={loading}
      />
    ),
  ].filter(Boolean) as JSX.Element[];

  // Mobile: os 3 indicadores viram um carrossel horizontal com "snap" (o
  // próximo cartão aparece pela metade, sinalizando que dá pra deslizar) em
  // vez de 3 cartões empilhados que ocupavam a primeira tela inteira.
  // A partir de 720px (tablet) os cartões cabem lado a lado e o carrossel vira
  // uma grade (ver .visao-geral__kpis em dashboard.css).
  const kpiRow = semDados ? null : isMobile ? (
    <div role="region" aria-label="Indicadores do mês" className="visao-geral__kpis">
      {kpiItems.map((item, i) => (
        <div key={i} className={`visao-geral__kpi${kpiItems.length === 1 ? ' visao-geral__kpi--unico' : ''}`}>
          {item}
        </div>
      ))}
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 14, flexDirection: 'row' }}>
      {kpiItems}
    </div>
  );

  // ── Chart Section ──────────────────────────────────────────────────────────
  const chartSection = semDados ? null : (
    <Card style={{ padding: isMobile ? '16px' : '20px 24px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>
            {comDinheiro || loading ? 'Análise de faturamento' : 'Ordens por dia'}
          </div>
          {!isMobile && (
            <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 2 }}>
              {comDinheiro || loading
                ? (fat?.origem === 'estimado' ? 'Faturamento estimado (R$) — sem entradas no Financeiro' : 'Faturamento (R$)')
                : 'Ordens de serviço abertas'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!isMobile && serieGrafico.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: tokens.color.muted }}>
              <span style={{ display: 'flex' }}>{Icons.cal}</span>
              {serieGrafico[0].dia} – {serieGrafico[serieGrafico.length - 1].dia}, {new Date().getFullYear()}
            </div>
          )}
          {!isMobile && (
            <div style={{ width: 155 }}>
              <Select
                name="dash_periodo_faturamento"
                value={periodoGrafico}
                onChangeValue={(v: string) => setPeriodoGrafico(v as PeriodoGrafico)}
                options={[...PERIODOS_GRAFICO]}
              />
            </div>
          )}
        </div>
      </div>
      {/* Mobile: período em chips (1 toque) em vez de um select de 155px que
          disputava a linha com o título */}
      {isMobile && (
        <div role="radiogroup" aria-label="Período do gráfico" style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
          {PERIODOS_GRAFICO.map(p => {
            const ativo = periodoGrafico === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setPeriodoGrafico(p)}
                style={{
                  flex: '1 1 0', minHeight: 44, padding: '0 12px', whiteSpace: 'nowrap',
                  borderRadius: 999, cursor: 'pointer', fontFamily: tokens.fontSans,
                  fontSize: '0.8125rem', fontWeight: ativo ? 700 : 600,
                  border: `1.5px solid ${ativo ? tokens.color.ferrari : tokens.color.border}`,
                  background: ativo ? tokens.color.accentDim : 'transparent',
                  color: ativo ? tokens.color.ferrari : tokens.color.textSecond,
                }}
              >
                {p.replace('Últimos ', '')}
              </button>
            );
          })}
        </div>
      )}
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
    <Card style={{ padding: isMobile ? '16px' : '20px 22px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="dashboard-card__header-title">Top serviços</div>
          <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 2 }}>OS finalizadas nos últimos 30 dias</div>
        </div>
        {comDinheiro && !isMobile && (
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

      {isMobile && comDinheiro && (
        <div style={{ marginBottom: 12 }}>
          <Select
            name="dash_ordenar_top_servicos_m"
            value={ordemTopServicos}
            onChangeValue={(v: string) => setOrdemTopServicos(v as OrdemTopServicos)}
            options={[...ORDEM_TOP_SERVICOS]}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${tokens.color.border}` }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.muted }}>Serviço</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.muted, width: 96, textAlign: 'right' }}>
            {comDinheiro ? 'Fat. est. (R$)' : 'Qtd.'}
          </span>
          {/* O mapa de calor da semana (7 quadradinhos) não cabe em telas
              estreitas: no celular fica só nome + valor. */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 4 }}>
              {HEAT_DAYS.map(d => (
                <div key={d} style={{ width: 18, fontSize: '0.75rem', textAlign: 'center', color: tokens.color.muted, fontWeight: 600 }}>{d}</div>
              ))}
            </div>
          )}
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
                <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond, width: isMobile ? 96 : 72, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>
                  {comDinheiro
                    ? (s.valorEstimado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : s.quantidade.toLocaleString('pt-BR')}
                </div>
                {!isMobile && <HeatmapRow heatmap={s.semana} />}
              </div>
            ))
        }
      </div>

      {!isMobile && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: `1px solid ${tokens.color.border}` }}>
        <span style={{ fontSize: '0.75rem', color: tokens.color.muted }}>Menor</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0.07, 0.18, 0.32, 0.5, 0.72, 0.9].map((o, i) => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: 4, background: `rgba(204,20,0,${o})` }} />
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: tokens.color.muted }}>Maior</span>
      </div>
      )}
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
            <button className="visao-geral__link" onClick={() => handleNav('financeiro')} style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
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
              <span style={{ fontSize: '0.75rem', color: tokens.color.muted, width: 36, flexShrink: 0 }}>{row.pct}%</span>
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
    <Card className="visao-geral__ordens" style={{ padding: isMobile ? '14px 16px' : '18px 20px', minWidth: 0 }}>
      <div className="dashboard-card__header">
        <div className="dashboard-card__header-title">ORDENS RECENTES</div>
        <button className="visao-geral__link" onClick={() => setPage('ordens')} style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
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
  // Os mesmos alertas reais da tela de Alertas (useAlertas): uma linha por tipo, com a
  // contagem. Antes eram frases fixas (ex.: "aguardando aprovação" contava rascunhos).
  const alertasLista: Alerta[] = alertasResumo.grupos.map(g => ({
    tipo: g.severidade,
    msg: g.fonte.resumo(g.itens.length),
    detalhe: g.itens.length === 1 ? g.itens[0].titulo : '',
  }));
  // O card inteiro, "Ver todas" e cada item abrem a tela de Alertas.
  const alertasSection = (
    <Card
      onClick={() => handleNav('alertas')}
      style={{ padding: isMobile ? '14px 16px' : '18px 20px', cursor: 'pointer' }}
    >
      <div className="dashboard-card__header" style={{ marginBottom: 12 }}>
        <div className="dashboard-card__header-title">ALERTAS IMPORTANTES</div>
        <button className="visao-geral__link" onClick={(e) => { e.stopPropagation(); handleNav('alertas'); }} style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Ver todas</button>
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
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleNav('alertas'); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleNav('alertas'); } }}
              style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: cfg.color, flexShrink: 0, marginTop: 1, display: 'flex' }}>{cfg.icon}</span>
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: tokens.color.text }}>{a.msg}</div>
                  {a.detalhe && <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 2 }}>{a.detalhe}</div>}
                </div>
              </div>
              <span style={{ color: tokens.color.muted, flexShrink: 0, display: 'flex' }}>{Icons.arrow}</span>
            </div>
          );
      })}
      </div>
      {!isMobile && (
        <button
          onClick={(e) => { e.stopPropagation(); handleNav('alertas'); }}
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
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 8px', minHeight: 48, width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `1px solid ${tokens.color.border}`, borderRadius: 6 }}
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
    <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
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
        {/* No tablet (≥ 720px) cada par fica lado a lado em vez de uma coluna esticada */}
        <div className="visao-geral__dupla">
          {topServicosSection}
          {acessosRapidos}
        </div>
        <div className="visao-geral__dupla">
          {ordensRecentes}
          {alertasSection}
        </div>
      </div>
      <MobileNav active={page} onNav={handleNav} onNewOS={onNewOS} />
      {sel && <OSModal ordem={sel} onClose={() => setSel(null)} onEdit={() => { onLoadOS?.(sel.id); setSel(null); }} />}
    </div>
  );

  // ── DESKTOP ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: tokens.color.bg }}>
      <Sidebar active={page} onNav={handleNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <DesktopHeader onNav={handleNav} />
        <div style={{ padding: '18px 28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {erroCard}
          {kpiRow}
          {/* Larguras em dashboard.css (.visao-geral__grafico / __rodape): antes eram
              fixas (1fr 420px / 320px 1fr 310px) e, num notebook de 1024px, o
              card de Ordens Recentes ficava com ~20px. */}
          {(chartSection || topServicosSection) && (
            <div className={`visao-geral__grafico${chartSection && topServicosSection ? '' : ' visao-geral__grafico--unico'}`}>
              {chartSection}
              {topServicosSection}
            </div>
          )}
          <div className={`visao-geral__rodape${resumoFinanceiro ? '' : ' visao-geral__rodape--sem-financeiro'}`}>
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
import { useState } from 'react';
import '../styles/dashboard.css';
import { tokens } from '../constants';
import { useResponsive } from '../components/ui';
import { useDashboard } from '../hooks/useDashboard';
import { formatBRL, HEAT_DAYS } from '../utils/dashboard';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useAuth } from '../context/AuthContext';

// Components
import { Sidebar, DesktopHeader, MobileTopbar, MobileNav, NAV_ITEMS } from '../features/Dashboard/Navigation';
import { KpiCard, MetaCard, Card, Skeleton, ProgressBar, HeatmapRow } from '../features/Dashboard/Primitives';
import { Icons, SVC_ICON } from '../features/Dashboard/Icons';
import { FaturamentoChart } from '../features/Dashboard/FaturamentoChart';
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

// Types
import type { NavPage, OrdemRow } from '../types/dashboard';

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
      <MobileTopbar />{content}<MobileNav active={page} onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={page} onNav={onNav} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{content}</main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard({ onNewOS, onLoadOS }: { onNewOS: () => void; onLoadOS?: (id: string) => void }) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const { loading, data } = useDashboard();
  const [page, setPage] = useState<NavPage>('dashboard');
  const [sel, setSel] = useState<OrdemRow | null>(null);
  // Foco pendente para a tela de Agendamentos (definido ao navegar a partir da
  // badge "Agendado" ou da aba Agendamentos no perfil de um cliente). Qualquer
  // navegação "normal" (sidebar, menu mobile, botão voltar) passa por
  // `handleNav` e limpa esse foco, para que ele nunca "vaze" para uma visita
  // posterior e não relacionada à tela de Agendamentos.
  const [agendaFocus, setAgendaFocus] = useState<{ search?: string; highlightId?: string } | null>(null);

  const handleNav = (p: NavPage) => { setAgendaFocus(null); setPage(p); };
  const handleGoToAgendamentos = (focus: { search?: string; highlightId?: string }) => {
    setAgendaFocus(focus);
    setPage('agendamentos');
  };

  if (page === 'ordens') {
    return <OrdensPage ordens={data.ordens} loading={loading} onNewOS={onNewOS} onLoadOS={onLoadOS} onNav={handleNav} isMobile={isMobile} />;
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
    return <EstoquePage onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} />;
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
    return <RelatoriosPage onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} />;
  }
  if (page !== 'dashboard') {
    return <PlaceholderPage page={page} onNav={handleNav} isMobile={isMobile} onNewOS={onNewOS} />;
  }

  const spark7 = data.fatDiario.map(d => d.valor);
  const sparkOS = data.fatDiario.map(d => Math.max(d.ordens, 1));

  // ── KPI Row ────────────────────────────────────────────────────────────────
  const kpiRow = (
    <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
      <KpiCard icon={Icons.dollar} title="Faturamento Total" value={formatBRL(data.fatAtual)} pct={data.fatPct} spark={spark7} loading={loading} />
      <KpiCard icon={Icons.orders} title="Ordens de Serviço" value={data.ordAtual.toLocaleString('pt-BR')} pct={data.ordPct} spark={sparkOS} loading={loading} />
      <MetaCard d={data} loading={loading} />
    </div>
  );

  // ── Chart Section ──────────────────────────────────────────────────────────
  const chartSection = (
    <Card style={{ padding: isMobile ? '16px' : '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.color.text }}>ANÁLISE DE FATURAMENTO</div>
          {!isMobile && <div style={{ fontSize: '0.72rem', color: tokens.color.muted, marginTop: 2 }}>Faturamento (R$)</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isMobile && data.fatDiario.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: tokens.color.muted }}>
              <span style={{ display: 'flex' }}>{Icons.cal}</span>
              {data.fatDiario[0].dia} – {data.fatDiario[6].dia}, {new Date().getFullYear()}
            </div>
          )}
          <select className="dashboard-card__select">
            <option>Últimos 7 dias</option>
            <option>Últimos 30 dias</option>
            <option>Este mês</option>
          </select>
          <button className="dashboard-card__icon-button">⋮</button>
        </div>
      </div>
      {loading
        ? <Skeleton h={isMobile ? 160 : 220} r={8} />
        : <FaturamentoChart data={data.fatDiario} height={isMobile ? 160 : 220} />
      }
    </Card>
  );

  // ── Top Serviços ───────────────────────────────────────────────────────────
  const topServicosSection = (
    <Card style={{ padding: isMobile ? '16px' : '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="dashboard-card__header-title">TOP SERVIÇOS</div>
        <select className="dashboard-card__select">
          <option>Ordenar por: Faturamento</option>
          <option>Ordenar por: Quantidade</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${tokens.color.border}` }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Serviço</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em', width: 72, textAlign: 'right' }}>
            Faturamento (R$)
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
          : data.topServicos.map(s => (
            <div key={s.nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(204,20,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CC1400', flexShrink: 0 }}>
                {SVC_ICON[s.nome] ?? Icons.wrench}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 500, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nome}</div>
              </div>
              <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond, width: 72, textAlign: 'right', flexShrink: 0, fontWeight: 500 }}>
                {s.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <HeatmapRow heatmap={s.heatmap} />
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
  const financeChartData = [
    { name: 'Receitas', value: data.receitas, color: '#CC1400' },
    { name: 'Custos', value: data.custos, color: '#D4A020' },
    { name: 'Lucro Líquido', value: data.lucro, color: '#1A7F4B' },
  ];

  const revenueBase = Math.max(data.receitas, 1);

  const financeRows = financeChartData.map(row => ({
    ...row,
    pct: row.name === 'Receitas' ? 100 : Math.round((row.value / revenueBase) * 100),
  }));

  const resumoFinanceiro = (
    <Card style={{ padding: '20px 22px' }}>
      <div className="dashboard-card__header">
        <div className="dashboard-card__header-title">RESUMO FINANCEIRO</div>
        <button className="dashboard-card__icon-button">⋮</button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          <Skeleton h={22} />
          <Skeleton h={22} />
          <Skeleton h={22} />
          <Skeleton h={140} />
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height: 190, marginBottom: 18 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financeChartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
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
              <ProgressBar pct={row.pct} color={row.color} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tokens.color.text, width: 90, textAlign: 'right', flexShrink: 0 }}>{formatBRL(row.value)}</span>
              <span style={{ fontSize: '0.7rem', color: tokens.color.muted, width: 36, flexShrink: 0 }}>{row.pct}%</span>
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 6, padding: '10px 13px', background: '#EFF8FF', borderRadius: 9, border: '1px solid #BAE0FD', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <span style={{ color: '#1565C0', flexShrink: 0, marginTop: 1, display: 'flex' }}>{Icons.info}</span>
        <span style={{ fontSize: '0.77rem', color: '#1565C0', lineHeight: 1.5 }}>
          Seu lucro líquido aumentou {Math.abs(data.fatPct).toFixed(1)}% em relação ao mês anterior. Continue assim!
        </span>
      </div>
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
      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: `1px solid ${tokens.color.border}` }}>
            <Skeleton h={58} r={8} />
          </div>
        ))
        : data.ordens.slice(0, 3).map(o => <OSRow key={o.id} ordem={o} onClick={() => setSel(o)} />)
      }
      {!loading && data.ordens.length === 0 && (
        <div className="dashboard-orders-empty">Nenhuma ordem ainda</div>
      )}
    </Card>
  );

  // ── Alertas ────────────────────────────────────────────────────────────────
  const alertasSection = (
    <Card style={{ padding: isMobile ? '14px 16px' : '18px 20px' }}>
      <div className="dashboard-card__header" style={{ marginBottom: 12 }}>
        <div className="dashboard-card__header-title">ALERTAS IMPORTANTES</div>
        <button style={{ border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Ver todas</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.alertas.map((a, i) => {
          const cfg = {
            crit: { bg: '#FFF0EE', border: 'rgba(204,20,0,0.18)', color: '#CC1400', icon: Icons.alert },
            warn: { bg: '#FFF8EC', border: 'rgba(179,92,0,0.18)', color: '#B35C00', icon: Icons.clock },
            info: { bg: '#F0FAF4', border: 'rgba(26,127,75,0.18)', color: '#1A7F4B', icon: Icons.cal },
          }[a.tipo];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: 'pointer' }}>
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
      })};
      </div>
      {!isMobile && (
        <button

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
    <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 90 }}>
      <MobileTopbar />
      <div style={{ padding: '16px 14px 0' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: tokens.color.text, margin: '0 0 2px' }}>
          Olá, {user?.nome ?? 'Lucas Andrelo'} 👋
        </h2>
        <p style={{ fontSize: '0.82rem', color: tokens.color.muted, margin: '0 0 16px' }}>Aqui está o desempenho da sua oficina hoje.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 14px' }}>
        {kpiRow}
        {chartSection}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
      <Sidebar active={page} onNav={handleNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <DesktopHeader />
        <div style={{ padding: '18px 28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {kpiRow}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 18 }}>
            {chartSection}
            {topServicosSection}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 310px', gap: 18 }}>
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
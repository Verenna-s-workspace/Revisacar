import { tokens } from '../../constants';
import { Icons } from './Icons';
import type { NavPage } from '../../types/dashboard';
import '../../styles/dashboard.css';
import { useAuth } from '../../context/AuthContext';
import { useAlertasResumo } from '../../hooks/useAlertasResumo';
import { useState } from 'react';
const NAV_ITEMS: { id: NavPage; icon: JSX.Element; label: string }[] = [
  { id: 'dashboard',    icon: Icons.home,            label: 'Visão Geral' },
  { id: 'ordens',       icon: Icons.orders,          label: 'Ordens de Serviço' },
  { id: 'atendimento',  icon: Icons.clipboardCheck,  label: 'Atendimento' },
  { id: 'agendamentos', icon: Icons.cal,             label: 'Agendamentos' },
  { id: 'clientes',     icon: Icons.user,            label: 'Clientes' },
  { id: 'veiculos',     icon: Icons.car,             label: 'Veículos' },
  { id: 'estoque',      icon: Icons.box,             label: 'Estoque' },
];

export { NAV_ITEMS };

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────

function iniciaisDe(nome?: string): string {
  if (!nome) return 'OF';
  const partes = nome.trim().split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

export function Sidebar({ active, onNav, onNewOS }: { active: NavPage; onNav: (p: NavPage) => void; onNewOS?: () => void }) {
  const { user, logout } = useAuth();
  const { total: totalAlertas, loading: carregandoAlertas } = useAlertasResumo();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <aside className="dashboard-sidebar" style={{ position: 'relative' }}>
      <div className="dashboard-sidebar__brand">
        <div className="dashboard-sidebar__brand-logo">
          <img
            src="/Logorevisavermelha.svg"
            alt=""
            className="dashboard-sidebar__brand-logo-image"
            style={{ width: 56, height: 56 }}
          />
        </div>
        <div className="dashboard-sidebar__brand-copy">
          <div className="dashboard-sidebar__brand-inner">
            Revisa<span>car</span>
          </div>
          <div className="dashboard-sidebar__brand-subtitle">
            sistema de gestão automotiva
          </div>
        </div>
      </div>

      {/* Cartão de Identidade — mostra só o dado real disponível hoje (user.nome
          como nome da oficina). A seta abre um menu com a sessão atual e sair;
          "trocar de usuário" fica pra quando existir modelo de funcionário/cargo
          (ver documento de arquitetura, seção de multi-tenancy) — não é
          fabricado aqui. */}
      <div className="dashboard-sidebar__identity">
        <div className="dashboard-sidebar__identity-avatar">{iniciaisDe(user?.nome)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dashboard-sidebar__identity-label">Oficina</div>
          <div className="dashboard-sidebar__identity-nome">{user?.nome ?? 'Oficina'}</div>
        </div>
        <button
          className="dashboard-sidebar__identity-chevron"
          onClick={() => setMenuAberto(v => !v)}
          title="Sessão"
        >
          {Icons.chevD}
        </button>

        {menuAberto && (
          <div className="dashboard-sidebar__identity-dropdown">
            <button
              className="dashboard-sidebar__identity-dropdown-item"
              onClick={() => { logout(); setMenuAberto(false); }}
              style={{ color: '#CC1400', fontWeight: 700 }}
            >
              Sair
            </button>
            <div className="dashboard-sidebar__identity-dropdown-hint">
              Troca entre funcionários da oficina chega numa próxima versão.
            </div>
          </div>
        )}
      </div>

      <nav className="dashboard-sidebar-nav">
        {NAV_ITEMS.filter(({ id }) => id !== 'configuracoes').map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={`dashboard-sidebar-link${active === id ? ' dashboard-sidebar-link--active' : ''}`}
          >
            <span style={{ flexShrink: 0, display: 'flex'}}>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {/* Bloco de Alertas — soma bloqueados + clientes não avisados (Atendimento)
          e baixo estoque + quarentena (Estoque). Só aparece quando há algo pra
          mostrar. Clique leva pra Atendimento por enquanto — provisório até
          existir uma tela de detalhe de alertas dedicada. */}
      {!carregandoAlertas && totalAlertas > 0 && (
        <button className="dashboard-sidebar__alertas" onClick={() => onNav('atendimento')}>
          <div className="dashboard-sidebar__alertas-titulo">           
         <h1>Alertas</h1>   
          </div>
          <div className="dashboard-sidebar__alertas-numero">{totalAlertas}</div>
          <div className="dashboard-sidebar__alertas-legenda">
            Você tem {totalAlertas} {totalAlertas === 1 ? 'alerta' : 'alertas'}, toque pra visualizar
          </div>
        </button>
      )}

      {/* Dock — Catálogo / Dicas / Configurações. Dicas ainda não tem tela própria
          (cai no PlaceholderPage genérico até existir uma). */}
      <div className="dashboard-sidebar__dock">
        <button className="dashboard-sidebar__dock-item" onClick={() => onNav('servicos')} title="Catálogo">
          {Icons.wrench}
        </button>     
        <button className="dashboard-sidebar__dock-item" onClick={() => onNav('relatorios')} title="Relátorios">
          {Icons.chart}
        </button>
        <button className="dashboard-sidebar__dock-item" onClick={() => onNav('financeiro')} title="Financeiro">
          {Icons.money}
        </button>   
         <button className="dashboard-sidebar__dock-item" onClick={() => onNav('dicas')} title="Dicas">
          {Icons.help}
        </button>
         <button className="dashboard-sidebar__dock-item" onClick={() => onNav('configuracoes')} title="Configurações">
          {Icons.cog}
        </button>
      </div>

      {onNewOS && (
        <button
          onClick={onNewOS}
          style={{
            margin: '0 16px 18px',
            padding: '56px 10px',
            borderRadius: 16,
            border: `2px dashed rgba(204, 20, 0, 0.64)`,
            background: '#faf8f8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#CC1400',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {Icons.plus}
          </span>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: tokens.color.textSecond, textAlign: 'center' }}>
            Criar Nova Solicitação
          </span>
        </button>
      )}
    </aside>
  );
}

// ── Desktop Header ─────────────────────────────────────────────────────────────

export function DesktopHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="dashboard-header">
      <div>
        <h1 className="dashboard-header__title">Olá, {user?.nome} 👋</h1>
        <p className="dashboard-header__subtitle">Aqui está o desempenho da sua oficina hoje.</p>
      </div>
      <div className="dashboard-header__actions" style={{ position: 'relative' }}>

        <div className="dashboard-header__indicator">
          <button className="dashboard-button">{Icons.bell}</button>
          <span className="dashboard-header__badge">3</span>
        </div>
        <button className="dashboard-button">{Icons.cal}</button>
        <div className="dashboard-header__separator" />
        <div
          className="dashboard-header__profile"
          onClick={() => setOpen(!open)}
          style={{ cursor: 'pointer' }}
        >
          <div className="dashboard-header__avatar">{Icons.user}</div>
          <div>
            <div className="dashboard-header__name">{user?.nome}</div>
            <div className="dashboard-header__role">Administrador</div>
          </div>
        </div>
        {open && (
          <div className="dashboard-header__dropdown" style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: 'white',
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 8,
            boxShadow: '0px 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: 160,
            padding: 8,
          }}>
            <button
              onClick={() => { logout(); setOpen(false); }}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '14px',
                color: '#CC1400',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {Icons.logout}
              Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mobile Topbar ─────────────────────────────────────────────────────────────

export function MobileTopbar({ onNav }: { onNav?: (p: NavPage) => void } = {}) {

  const { user } = useAuth();
  const { total: totalAlertas } = useAlertasResumo();

  return (
    <div className="dashboard-mobile-topbar">
      <button className="dashboard-mobile-topbar__button">{Icons.menu}</button>
      <div className="dashboard-mobile-topbar__logo">
        <img src="/Logorevisavermelha.svg" alt="" width={30} height={30} />
        <span style={{ fontFamily: "'Fredoka',cursive", fontSize: '1rem', color: tokens.color.text }}>
          revisa<span style={{ color: '#CC1400' }}>car</span>
        </span>
      </div>
      <div className="dashboard-mobile-topbar__actions">
        {totalAlertas > 0 && (
          <button
            onClick={() => onNav?.('atendimento')}
            style={{ position: 'relative', border: 'none', background: 'transparent', padding: 4, display: 'flex' }}
            title={`${totalAlertas} alertas`}
          >
            <span style={{ color: tokens.color.muted, display: 'flex' }}>{Icons.bell}</span>
            <span style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, background: '#CC1400', color: 'white', borderRadius: 99, fontSize: '0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {totalAlertas}
            </span>
          </button>
        )}
        <button
          onClick={() => onNav?.('dicas')}
          style={{ border: 'none', background: 'transparent', padding: 4, display: 'flex', color: tokens.color.muted }}
          title="Dicas"
        >
          {Icons.info}
        </button>
        <button
          onClick={() => onNav?.('configuracoes')}
          style={{ border: 'none', background: 'transparent', padding: 4, display: 'flex', color: tokens.color.muted }}
          title="Configurações"
        >
          {Icons.cog}
        </button>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: tokens.color.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}>
          {Icons.user}
        </div>
      </div>
    </div>
  );
}

// ── Mobile Bottom Nav ─────────────────────────────────────────────────────────

interface MobileNavProps {
  active: NavPage;
  onNav: (p: NavPage) => void;
  onNewOS: () => void;
}

export function MobileNav({ active, onNav, onNewOS }: MobileNavProps) {
  const left = [
    { icon: Icons.home,   label: 'Início',    p: 'dashboard' as NavPage },
    { icon: Icons.orders, label: 'Ordens',    p: 'ordens' as NavPage },
  ];
  const right = [
    { icon: Icons.box,   label: 'Estoque',   p: 'estoque' as NavPage },
    { icon: Icons.chart, label: 'Relatórios', p: 'relatorios' as NavPage },
  ];

  return (
    <nav className="dashboard-mobile-bottom-nav">
      {left.map(x => (
        <button
          key={x.p}
          onClick={() => onNav(x.p)}
          className={`dashboard-mobile-bottom-nav__item${active === x.p ? ' dashboard-mobile-bottom-nav__item--active' : ''}`}
        >
          {x.icon} {x.label}
        </button>
      ))}
      <button className="dashboard-mobile-bottom-nav__fab" onClick={onNewOS}>
        {Icons.plus}
      </button>
      {right.map(x => (
        <button
          key={x.p}
          onClick={() => onNav(x.p)}
          className={`dashboard-mobile-bottom-nav__item${active === x.p ? ' dashboard-mobile-bottom-nav__item--active' : ''}`}
        >
          {x.icon} {x.label}
        </button>
      ))}
    </nav>
  );

}


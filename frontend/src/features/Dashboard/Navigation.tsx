import { tokens } from '../../constants';
import { Icons } from './Icons';
import type { NavPage } from '../../types/dashboard';
import '../../styles/dashboard.css';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
const NAV_ITEMS: { id: NavPage; icon: JSX.Element; label: string }[] = [
  { id: 'dashboard',    icon: Icons.home,   label: 'Visão Geral' },
  { id: 'ordens',       icon: Icons.orders, label: 'Ordens de Serviço' },
  { id: 'agendamentos', icon: Icons.cal,    label: 'Agendamentos' },
  { id: 'clientes',     icon: Icons.user,   label: 'Clientes' },
  { id: 'veiculos',     icon: Icons.car,    label: 'Veículos' },
  { id: 'estoque',      icon: Icons.box,    label: 'Estoque' },
  { id: 'servicos',     icon: Icons.wrench, label: 'Catálogo' },
  { id: 'financeiro',   icon: Icons.money,  label: 'Financeiro' },
  { id: 'relatorios',   icon: Icons.chart,  label: 'Relatórios' },
  { id: 'configuracoes',icon: Icons.cog,    label: 'Configurações' },
];

export { NAV_ITEMS };

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────

export function Sidebar({ active, onNav }: { active: NavPage; onNav: (p: NavPage) => void }) {
  return (
    <aside className="dashboard-sidebar" style={{ position: 'relative' }}>
      <svg
        className="dashboard-sidebar__wave"
        viewBox="0 0 228 220"
        preserveAspectRatio="none"
      >
        <path d="M0,120 Q57,70 114,110 Q171,150 228,100 L228,220 L0,220Z" fill="white" />
        <path d="M0,160 Q57,120 114,150 Q171,180 228,140 L228,220 L0,220Z" fill="white" />
      </svg>

      <div className="dashboard-sidebar__brand">
        <div className="dashboard-sidebar__brand-logo">
          <img
            src="/Logorevisavermelha.svg"
            alt=""
            className="dashboard-sidebar__brand-logo-image"
            style={{ filter: 'brightness(0) invert(1)', width: 56, height: 56 }}
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

      <nav className="dashboard-sidebar-nav">
        {NAV_ITEMS.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={`dashboard-sidebar-link${active === id ? ' dashboard-sidebar-link--active' : ''}`}
          >
            <span style={{ opacity: active === id ? 1 : 0.8, flexShrink: 0, display: 'flex' }}>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>


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
        <h1 className="dashboard-header__title">Olá, {user?.nome ?? 'Lucas Andrelo'} 👋</h1>
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
            <div className="dashboard-header__name">{user?.nome ?? 'Lucas Andrelo'}</div>
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

export function MobileTopbar() {

  const { user } = useAuth();

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
        <div style={{ position: 'relative' }}>
          <span style={{ color: tokens.color.muted, display: 'flex' }}>{Icons.bell}</span>
          <span style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, background: '#CC1400', color: 'white', borderRadius: 99, fontSize: '0.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
        </div>
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


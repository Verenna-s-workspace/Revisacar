import { tokens } from '../../constants';
import { Icons } from './Icons';
import type { NavPage } from '../../types/dashboard';
import '../../styles/dashboard.css';
import { useAuth } from '../../context/AuthContext';
import { useAlertasResumo } from '../../hooks/useAlertasResumo';
import { usePermissions } from '../../hooks/usePermissions';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rotuloDoCargo } from '../../utils/cargo';
// ── Acessibilidade de diálogos (drawer) ──────────────────────────────────────
// Foco entra no painel, Tab fica preso dentro dele, Esc fecha, o fundo não rola
// e o foco volta pro botão que abriu. Antes o drawer tinha role="dialog" mas
// nada disso — quem usa teclado/leitor de tela "saía" do menu sem querer.
function useDialogA11y(open: boolean, ref: React.RefObject<HTMLElement>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const node = ref.current;
    const focusables = (): HTMLElement[] => {
      if (!node) return [];
      const found: HTMLElement[] = Array.from(
        node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      );
      return found.filter((el: HTMLElement) => !el.hasAttribute('disabled'));
    };
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, ref]);
}

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
  const { can } = usePermissions();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <aside className="dashboard-sidebar">
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
          className="dashboard-sidebar__identity-chevron tap-area"
          onClick={() => setMenuAberto(v => !v)}
          title="Sessão"
          aria-label="Menu da sessão"
          aria-expanded={menuAberto}
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
            type="button"
            onClick={() => onNav(id)}
            aria-current={active === id ? 'page' : undefined}
            className={`dashboard-sidebar-link${active === id ? ' dashboard-sidebar-link--active' : ''}`}
          >
            <span style={{ flexShrink: 0, display: 'flex'}}>
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {/* Bloco de Alertas — total de alertas (ver utils/alertas.ts). Só aparece
          quando há algo pra mostrar; o clique abre a tela de Alertas. */}
      {!carregandoAlertas && totalAlertas > 0 && (
        <button className="dashboard-sidebar__alertas" onClick={() => onNav('alertas')}>
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
        <button className="dashboard-sidebar__dock-item" onClick={() => onNav('servicos')} title="Catálogo" aria-label="Catálogo de serviços">
          {Icons.wrench}
        </button>     
        <button className="dashboard-sidebar__dock-item" onClick={() => onNav('relatorios')} title="Relatórios" aria-label="Relatórios">
          {Icons.chart}
        </button>
        {can('financeiro.ver') && (
          <button className="dashboard-sidebar__dock-item" onClick={() => onNav('financeiro')} title="Financeiro" aria-label="Financeiro">
            {Icons.money}
          </button>
        )}   
         <button className="dashboard-sidebar__dock-item" onClick={() => onNav('dicas')} title="Dicas" aria-label="Dicas">
          {Icons.help}
        </button>
         <button className="dashboard-sidebar__dock-item" onClick={() => onNav('configuracoes')} title="Configurações" aria-label="Configurações">
          {Icons.cog}
        </button>
      </div>

      {onNewOS && (
        <button
          onClick={onNewOS}
          style={{
            // Era 56px de padding vertical: sozinho ocupava ~190px e empurrava a
            // sidebar pra além de 768px de altura.
            margin: '0 16px 18px',
            padding: '18px 10px',
            borderRadius: 16,
            border: `2px dashed rgba(204, 20, 0, 0.64)`,
            background: 'var(--color-bg-alt)',
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

export function DesktopHeader({ onNav }: { onNav?: (p: NavPage) => void } = {}) {
  const { user, logout } = useAuth();
  const { total: totalAlertas } = useAlertasResumo();
  const [open, setOpen] = useState(false);

  return (
    <div className="dashboard-header">
      <div>
        <h1 className="dashboard-header__title">Olá, {user?.nome ?? 'Usuário'} 👋</h1>
        <p className="dashboard-header__subtitle">Aqui está o desempenho da sua oficina hoje.</p>
      </div>
      <div className="dashboard-header__actions" style={{ position: 'relative' }}>

        <div className="dashboard-header__indicator">
          <button className="dashboard-button" onClick={() => onNav?.('alertas')} title="Alertas" aria-label={totalAlertas > 0 ? `Ver alertas (${totalAlertas})` : 'Ver alertas'}>{Icons.bell}</button>
          {totalAlertas > 0 && <span className="dashboard-header__badge">{totalAlertas}</span>}
        </div>
        <button className="dashboard-button" onClick={() => onNav?.('agendamentos')} title="Agendamentos" aria-label="Ver agendamentos">{Icons.cal}</button>
        <div className="dashboard-header__separator" />
        <div
          className="dashboard-header__profile"
          role="button"
          tabIndex={0}
          onClick={() => setOpen(!open)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
          style={{ cursor: 'pointer' }}
        >
          <div className="dashboard-header__avatar">{Icons.user}</div>
          <div>
            <div className="dashboard-header__name">{user?.nome ?? 'Usuário'}</div>
            <div className="dashboard-header__role">{rotuloDoCargo(user)}</div>
          </div>
        </div>
        
          </div>
        
      </div>
   
  );
}

// ── Mobile Topbar ─────────────────────────────────────────────────────────────

interface MobileTopbarProps {
  onNav?: (p: NavPage) => void;
  /** Página atual, pra destacar o item certo dentro do menu. */
  active?: NavPage;
}

export function MobileTopbar({ onNav, active }: MobileTopbarProps) {

  const { user, logout } = useAuth();
  const { total: totalAlertas } = useAlertasResumo();
  const { can } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useDialogA11y(menuOpen, drawerRef, () => setMenuOpen(false));

  function navegar(p: NavPage) {
    setMenuOpen(false);
    onNav?.(p);
  }

  return (
    <div className="dashboard-mobile-topbar">
      <button
        className="dashboard-mobile-topbar__button"
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
      >
        {Icons.menu}
      </button>
      <div className="dashboard-mobile-topbar__logo">
        <img src="/Logorevisavermelha.svg" alt="" width={30} height={30} />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: '1rem', color: tokens.color.text }}>
          Revisa<span style={{ color: '#CC1400' }}>car</span>
        </span>
      </div>
      {/* Só o sino fica no topo (com badge). Dicas e Configurações já estão no
          menu lateral; o avatar parecia botão e não era. Cada ícone agora tem
          alvo de 44px — com 4 ícones + hambúrguer + logo não cabia em 360px. */}
      <div className="dashboard-mobile-topbar__actions">
        <button
          type="button"
          className="dashboard-mobile-topbar__button dashboard-mobile-topbar__button--end"
          onClick={() => onNav?.('alertas')}
          style={{ position: 'relative' }}
          aria-label={totalAlertas > 0 ? `Ver alertas (${totalAlertas})` : 'Ver alertas'}
        >
          <span style={{ display: 'flex' }}>{Icons.bell}</span>
          {totalAlertas > 0 && (
            <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, padding: '0 4px', boxSizing: 'border-box', background: '#CC1400', color: 'white', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {totalAlertas > 99 ? '99+' : totalAlertas}
            </span>
          )}
        </button>
      </div>

      {menuOpen && createPortal(
        <>
          <div className="dashboard-mobile-drawer-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="dashboard-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu principal" ref={drawerRef}>
            <div className="dashboard-mobile-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <img src="/Logorevisavermelha.svg" alt="" width={30} height={30} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', color: tokens.color.text }}>
                  Revisa<span style={{ color: '#CC1400' }}>car</span>
                </span>
              </div>
              <button type="button" className="dashboard-button--close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">×</button>
            </div>

            <div className="dashboard-mobile-drawer__identity">
              <div className="dashboard-sidebar__identity-avatar">{iniciaisDe(user?.nome)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="dashboard-sidebar__identity-label">Oficina</div>
                <div className="dashboard-sidebar__identity-nome">{user?.nome ?? 'Oficina'}</div>
              </div>
            </div>

            <nav className="dashboard-mobile-drawer__nav">
              {NAV_ITEMS.filter(({ id }) => id !== 'configuracoes').map(({ id, icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navegar(id)}
                  aria-current={active === id ? 'page' : undefined}
                  className={`dashboard-mobile-drawer__link${active === id ? ' dashboard-mobile-drawer__link--active' : ''}`}
                >
                  <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
                  {label}
                </button>
              ))}

              <div className="dashboard-mobile-drawer__divider" />

              <button onClick={() => navegar('servicos')} className={`dashboard-mobile-drawer__link${active === 'servicos' ? ' dashboard-mobile-drawer__link--active' : ''}`}>
                <span style={{ flexShrink: 0, display: 'flex' }}>{Icons.wrench}</span>
                Catálogo de Serviços
              </button>
              <button onClick={() => navegar('relatorios')} className={`dashboard-mobile-drawer__link${active === 'relatorios' ? ' dashboard-mobile-drawer__link--active' : ''}`}>
                <span style={{ flexShrink: 0, display: 'flex' }}>{Icons.chart}</span>
                Relatórios
              </button>
              {can('financeiro.ver') && (
                <button onClick={() => navegar('financeiro')} className={`dashboard-mobile-drawer__link${active === 'financeiro' ? ' dashboard-mobile-drawer__link--active' : ''}`}>
                  <span style={{ flexShrink: 0, display: 'flex' }}>{Icons.money}</span>
                  Financeiro
                </button>
              )}
              <button onClick={() => navegar('dicas')} className={`dashboard-mobile-drawer__link${active === 'dicas' ? ' dashboard-mobile-drawer__link--active' : ''}`}>
                <span style={{ flexShrink: 0, display: 'flex' }}>{Icons.help}</span>
                Dicas
              </button>
              <button onClick={() => navegar('configuracoes')} className={`dashboard-mobile-drawer__link${active === 'configuracoes' ? ' dashboard-mobile-drawer__link--active' : ''}`}>
                <span style={{ flexShrink: 0, display: 'flex' }}>{Icons.cog}</span>
                Configurações
              </button>
            </nav>

            <button className="dashboard-mobile-drawer__logout" onClick={() => { setMenuOpen(false); logout(); }}>
              {Icons.logout}
              Sair
            </button>
          </div>
        </>,
        document.body
      )}
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
    <nav className="dashboard-mobile-bottom-nav" aria-label="Navegação principal">
      {left.map(x => (
        <button
          key={x.p}
          type="button"
          onClick={() => onNav(x.p)}
          aria-current={active === x.p ? 'page' : undefined}
          className={`dashboard-mobile-bottom-nav__item${active === x.p ? ' dashboard-mobile-bottom-nav__item--active' : ''}`}
        >
          {x.icon} {x.label}
        </button>
      ))}
      <button
        type="button"
        className="dashboard-mobile-bottom-nav__fab"
        onClick={onNewOS}
        aria-label="Nova ordem de serviço"
      >
        {Icons.plus}
      </button>
      {right.map(x => (
        <button
          key={x.p}
          type="button"
          onClick={() => onNav(x.p)}
          aria-current={active === x.p ? 'page' : undefined}
          className={`dashboard-mobile-bottom-nav__item${active === x.p ? ' dashboard-mobile-bottom-nav__item--active' : ''}`}
        >
          {x.icon} {x.label}
        </button>
      ))}
    </nav>
  );

}
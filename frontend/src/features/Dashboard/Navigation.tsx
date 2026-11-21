import { tokens } from '../../constants';
import { Icons } from './Icons';
import type { NavPage } from '../../types/dashboard';
import '../../styles/dashboard.css';
import { useAuth } from '../../context/AuthContext';
import { useAlertasResumo } from '../../hooks/useAlertasResumo';
import { usePermissions } from '../../hooks/usePermissions';
import { useEffect, useRef, useState } from 'react';
import { rotuloDoCargo } from '../../utils/cargo';
import { BotaoPrivacidade } from '../../components/Privacidade';
import { AppTopBar } from '../../components/AppTopBar';
import { useNomeOficina } from '../../hooks/UseNomeOficina';
import { semAnimacaoDeLargura, useSidebarColapsada } from '../../hooks/useSidebarColapsada';
import '../../styles/sidebar.css';
import { ICONES_PAGINA, ICONES_SIDEBAR } from './SidebarIcons';

/** Telas que mostram valores financeiros — só nelas aparece o botão do Modo Privacidade. */
export const TELAS_COM_PRIVACIDADE: readonly NavPage[] = ['dashboard', 'financeiro', 'relatorios'];

const NAV_ITEMS: { id: NavPage; icon: JSX.Element; label: string }[] = [
  { id: 'dashboard',    icon: Icons.home,            label: 'Visão Geral' },
  { id: 'ordens',       icon: Icons.orders,          label: 'Ordens de Serviço' },
  { id: 'atendimento',  icon: Icons.clipboardCheck,  label: 'Atendimento' },
  { id: 'agendamentos', icon: Icons.cal,             label: 'Agenda' },
  { id: 'clientes',     icon: Icons.user,            label: 'Clientes' },
  { id: 'veiculos',     icon: Icons.car,             label: 'Veículos' },
  { id: 'estoque',      icon: Icons.box,             label: 'Estoque' },
];

export { NAV_ITEMS };

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────
//
// Encostada na lateral, em altura total, com versão expandida e compacta (botão no
// cabeçalho). Estilos em styles/sidebar.css; ícones em ./SidebarIcons; o estado
// expandida/compacta fica em hooks/useSidebarColapsada (sobrevive à navegação,
// porque cada página monta a sua própria <Sidebar>). A assinatura é a mesma de
// antes — as páginas não mudam. É a própria <aside> que anima a largura, e o
// <main> ao lado se expande junto.

function iniciaisDe(nome?: string): string {
  if (!nome) return 'OF';
  const partes = nome.trim().split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

interface ItemMenu { id: NavPage; icon: JSX.Element; label: string }

/** O login ainda não devolve foto do funcionário; quando devolver (`foto` = URL), ela aparece
 *  no rodapé sem mexer aqui. Enquanto isso, o círculo mostra as iniciais. */
type UsuarioLogado = NonNullable<ReturnType<typeof useAuth>['user']> & { foto?: string | null };

export function Sidebar({ active, onNav, onNewOS }: { active: NavPage; onNav: (p: NavPage) => void; onNewOS?: () => void }) {
  const { user, logout } = useAuth();
  const { can } = usePermissions();
  const nomeOficina = useNomeOficina();
  const [colapsada, alternar] = useSidebarColapsada();
  const [semAnimacao] = useState(semAnimacaoDeLargura);
  const [menuAberto, setMenuAberto] = useState(false);
  const [dica, setDica] = useState<{ texto: string; top: number } | null>(null);
  const [fotoFalhou, setFotoFalhou] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const corpoRef = useRef<HTMLElement>(null);
  const rodapeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const usuario = user as UsuarioLogado | null;
  const nomeFuncionario = usuario?.nome ?? 'Usuário';
  const foto = !fotoFalhou && usuario?.foto ? usuario.foto : null;

  // Grupo "Menu": os itens de navegação + Catálogo de Serviços, Relatórios e Financeiro (antes no dock).
  const itensMenu: ItemMenu[] = [
    ...NAV_ITEMS.map(item => ({ ...item, icon: ICONES_PAGINA[item.id] ?? item.icon })),
    { id: 'servicos',   icon: ICONES_PAGINA.servicos ?? Icons.wrench, label: 'Catálogo de Serviços' },
    { id: 'relatorios', icon: ICONES_PAGINA.relatorios ?? Icons.chart, label: 'Relatórios' },
    ...(can('financeiro.ver') ? [{ id: 'financeiro' as NavPage, icon: ICONES_PAGINA.financeiro ?? Icons.money, label: 'Financeiro' }] : []),
  ];

  // Grupo inferior: o que sobrou do antigo dock.
  const itensAtalhos: ItemMenu[] = [
    { id: 'dicas',         icon: ICONES_PAGINA.dicas ?? Icons.help, label: 'Dicas' },
    { id: 'configuracoes', icon: ICONES_PAGINA.configuracoes ?? Icons.cog, label: 'Configurações' },
  ];

  // Cada página monta a sua própria sidebar, então a lista volta ao topo a cada navegação.
  // Em janela baixa (a lista rola) isso esconderia o item ativo: traz ele pra vista.
  useEffect(() => {
    const corpo = corpoRef.current;
    const ativo = corpo?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!corpo || !ativo) return;
    const c = corpo.getBoundingClientRect();
    const a = ativo.getBoundingClientRect();
    if (a.bottom > c.bottom) corpo.scrollTop += a.bottom - c.bottom + 8;
    else if (a.top < c.top) corpo.scrollTop -= c.top - a.top + 8;
  }, [active]);

  // Menu da sessão (Sair): fecha com clique fora ou Esc.
  useEffect(() => {
    if (!menuAberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (menuRef.current?.contains(alvo) || rodapeRef.current?.contains(alvo)) return;
      setMenuAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuAberto(false); rodapeRef.current?.focus(); }
    };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [menuAberto]);

  // Balão com o nome do item — só na versão compacta (onde não há texto).
  function mostrarDica(el: HTMLElement, texto: string) {
    if (!colapsada) return;
    const base = asideRef.current?.getBoundingClientRect();
    if (!base) return;
    const r = el.getBoundingClientRect();
    setDica({ texto, top: r.top - base.top + r.height / 2 });
  }
  const esconderDica = () => setDica(null);

  function alternarSidebar() {
    setDica(null);
    setMenuAberto(false);
    alternar();
  }

  function renderItem({ id, icon, label }: ItemMenu) {
    const ativo = active === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => { esconderDica(); onNav(id); }}
        onMouseEnter={e => mostrarDica(e.currentTarget, label)}
        onMouseLeave={esconderDica}
        onFocus={e => mostrarDica(e.currentTarget, label)}
        onBlur={esconderDica}
        aria-current={ativo ? 'page' : undefined}
        className={`rv-sb__item${ativo ? ' rv-sb__item--ativo' : ''}`}
      >
        <span className="rv-sb__icone" aria-hidden="true">{icon}</span>
        <span className="rv-sb__rotulo">{label}</span>
      </button>
    );
  }

  return (
    <aside
      ref={asideRef}
      className={`rv-sb${semAnimacao ? ' rv-sb--sem-anim' : ''}`}
      data-colapsada={colapsada}
      aria-label="Barra lateral"
    >
      <div className="rv-sb__painel">
        {/* Cabeçalho: logo + nome + botão de colapsar. Compacta: só a logo; ao passar o mouse
            nela, o botão de expandir aparece no lugar (ele fica ancorado à direita do painel,
            então termina exatamente em cima da logo). */}
        <div className="rv-sb__topo">
          <img className="rv-sb__marca-img" src="/Logorevisavermelha.svg" alt="" width={40} height={40} />
          <span className="rv-sb__marca-nome">Revisacar</span>
          <button
            type="button"
            className="rv-sb__toggle"
            onClick={alternarSidebar}
            aria-label={colapsada ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-expanded={!colapsada}
          >
            {ICONES_SIDEBAR.painel}
          </button>
        </div>

        <div className="rv-sb__sep" />

        <nav ref={corpoRef} className="rv-sb__corpo" aria-label="Navegação principal" onScroll={esconderDica}>
          <div className="rv-sb__secao">Menu</div>
          {itensMenu.map(renderItem)}
        </nav>

        {/* Ação principal: cartão na expandida; só o círculo na compacta. */}
        {onNewOS && (
          <div className="rv-sb__acao">
            <div className="rv-sb__card">
              <div className="rv-sb__card-topo">
                <span className="rv-sb__card-circ" aria-hidden="true">{ICONES_SIDEBAR.plus}</span>
                <span className="rv-sb__card-tit">
                  <span className="rv-sb__card-sub">Ordem de serviço</span>
                  <strong>Nova ordem</strong>
                </span>
              </div>
              <p className="rv-sb__card-desc">Registre o veículo e o serviço para dar início ao atendimento.</p>
              <button
                type="button"
                className="rv-sb__card-btn"
                onClick={() => { esconderDica(); onNewOS(); }}
                onMouseEnter={e => mostrarDica(e.currentTarget, 'Criar OS')}
                onMouseLeave={esconderDica}
                aria-label="Criar OS"
              >
                {ICONES_SIDEBAR.plus}
                <span className="rv-sb__card-txt">Criar OS</span>
              </button>
            </div>
          </div>
        )}

        <div className="rv-sb__sep" />

        <nav className="rv-sb__grupo" aria-label="Atalhos">
          {itensAtalhos.map(renderItem)}
        </nav>

        <div className="rv-sb__sep" />

        {/* Rodapé: foto do funcionário + (em cima) oficina, mais suave; (embaixo) funcionário. */}
        <button
          ref={rodapeRef}
          type="button"
          className="rv-sb__rodape"
          onClick={() => { esconderDica(); setMenuAberto(v => !v); }}
          onMouseEnter={e => mostrarDica(e.currentTarget, nomeFuncionario)}
          onMouseLeave={esconderDica}
          aria-haspopup="true"
          aria-expanded={menuAberto}
        >
          <span className="rv-sb__avatar" aria-hidden="true">
            {foto
              ? <img src={foto} alt="" onError={() => setFotoFalhou(true)} />
              : iniciaisDe(nomeFuncionario)}
          </span>
          <span className="rv-sb__rodape-textos">
            <span className="rv-sb__oficina">{nomeOficina || 'Oficina'}</span>
            <span className="rv-sb__funcionario">{nomeFuncionario}</span>
          </span>
          <span className="rv-sb__seletor" aria-hidden="true">{ICONES_SIDEBAR.seletor}</span>
        </button>
      </div>

      {dica && <div className="rv-sb__dica" style={{ top: dica.top }}>{dica.texto}</div>}

      {menuAberto && (
        <div className="rv-sb__menu" ref={menuRef}>
          <div className="rv-sb__menu-id">
            <div className="rv-sb__menu-nome">{nomeFuncionario}</div>
            {rotuloDoCargo(user) && <div className="rv-sb__menu-cargo">{rotuloDoCargo(user)}</div>}
          </div>
          <button type="button" className="rv-sb__menu-sair" onClick={() => { setMenuAberto(false); logout(); }}>
            {ICONES_SIDEBAR.sair}
            Sair
          </button>
          <div className="rv-sb__menu-aviso">Mantenha seus dados seguros. Não compartilhe suas credenciais.</div>
        </div>
      )}
    </aside>
  );
}

// ── Desktop Header ─────────────────────────────────────────────────────────────

export function DesktopHeader({ onNav, active }: { onNav?: (p: NavPage) => void; active?: NavPage } = {}) {
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

        {active && TELAS_COM_PRIVACIDADE.includes(active) && <BotaoPrivacidade variante="desktop" />}
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
  /** Página atual. */
  active?: NavPage;
}

export function MobileTopbar({ onNav, active }: MobileTopbarProps) {
  const { total: totalAlertas } = useAlertasResumo();

  return (
    <AppTopBar
      className="dashboard-mobile-topbar"
      onLogoClick={() => onNav?.('dashboard')}
      logoLabel="Ir para a Visão Geral"
      end={
        <>
          {active && TELAS_COM_PRIVACIDADE.includes(active) && <BotaoPrivacidade variante="mobile" />}
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
        </>
      }
    />
  );
}

// ── Mobile Bottom Nav ─────────────────────────────────────────────────────────

interface MobileNavProps {
  active: NavPage;
  onNav: (p: NavPage) => void;
  onNewOS?: () => void;
}

export function MobileNav({ active, onNav }: MobileNavProps) {
  const items: { key: string; label: string; icon: JSX.Element; page: NavPage }[] = [
    { key: 'dashboard',    label: 'Geral',    icon: ICONES_PAGINA.dashboard ?? Icons.home,   page: 'dashboard' },
    { key: 'ordens',       label: 'Ordens',   icon: ICONES_PAGINA.ordens ?? Icons.orders,    page: 'ordens' },
    { key: 'agendamentos', label: 'Agenda',   icon: ICONES_PAGINA.agendamentos ?? Icons.cal, page: 'agendamentos' },
    { key: 'clientes',     label: 'Clientes', icon: ICONES_PAGINA.clientes ?? Icons.user,    page: 'clientes' },
    { key: 'mais',         label: 'Mais',     icon: ICONES_SIDEBAR.mais,                     page: 'mais' },
  ];

  return (
    <nav className="dashboard-mobile-bottom-nav" aria-label="Navegação principal">
      {items.map(item => {
        const isActive = active === item.page;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNav(item.page)}
            aria-current={isActive ? 'page' : undefined}
            className={`dashboard-mobile-bottom-nav__item${isActive ? ' dashboard-mobile-bottom-nav__item--active' : ''}`}
          >
            <span className="dashboard-mobile-bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="dashboard-mobile-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
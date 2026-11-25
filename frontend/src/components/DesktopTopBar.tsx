import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlertasResumo } from '../hooks/useAlertasResumo';
import { rotuloDoCargo } from '../utils/cargo';
import { BotaoPrivacidade } from './Privacidade';
import type { NavPage } from '../types/dashboard';
import '../styles/desktop-topbar.css';

/**
 * Top-bar do desktop (56px): breadcrumb, busca global (⌘K), privacidade (ocultar valores),
 * notificações e usuário. Sem saudação. Cada página do painel a coloca no topo do seu <main>
 * (as páginas montam a própria sidebar), então ela aparece em todas as telas.
 *
 * A busca ainda NÃO funciona: é só o desenho (sem foco, sem atalho ⌘K). Quando ela existir,
 * troque o <div> por um botão que abre a paleta de comandos.
 */

/** Grupo + nome da tela no breadcrumb. É a única lista a mexer para renomear/regrupar. */
const MIGALHAS: Record<NavPage, [string, string]> = {
  dashboard:     ['Operação', 'Hoje'],
  ordens:        ['Operação', 'Ordens de serviço'],
  atendimento:   ['Operação', 'Atendimento'],
  agendamentos:  ['Operação', 'Agenda'],
  alertas:       ['Operação', 'Alertas'],
  clientes:      ['Cadastros', 'Clientes'],
  veiculos:      ['Cadastros', 'Veículos'],
  estoque:       ['Cadastros', 'Estoque'],
  servicos:      ['Cadastros', 'Catálogo de serviços'],
  financeiro:    ['Gestão', 'Financeiro'],
  relatorios:    ['Gestão', 'Relatórios'],
  configuracoes: ['Sistema', 'Configurações'],
  dicas:         ['Sistema', 'Dicas'],
  mais:          ['Sistema', 'Mais'],
};

const svg = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const IcBusca = <svg {...svg} width={16} height={16}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
const IcSino = <svg {...svg}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
const IcSair = <svg {...svg} width={16} height={16}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;

function iniciaisDe(nome?: string): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return partes[0] ? partes[0].slice(0, 2).toUpperCase() : 'OF';
}

/** Item da trilha própria (telas fora da navegação, como a OS): o último é a página atual. Com `onClick` vira botão. */
export interface ItemTrilha { rotulo: string; onClick?: () => void }

export function DesktopTopBar({ page, onNav, trilha }: { page: NavPage; onNav: (p: NavPage) => void; trilha?: ItemTrilha[] }) {
  const { user, logout } = useAuth();
  const { total } = useAlertasResumo();
  const [menuAberto, setMenuAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAberto) return;
    const fora = (e: MouseEvent) => { if (!raizRef.current?.contains(e.target as Node)) setMenuAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [menuAberto]);

  const [grupo, tela] = MIGALHAS[page] ?? ['Operação', 'Hoje'];
  const nome = user?.nome ?? 'Usuário';
  const primeiroNome = nome.trim().split(/\s+/)[0] || 'Usuário';
  const cargo = rotuloDoCargo(user);

  return (
    <header className="rv-tb">
      <nav className="rv-tb__crumb" aria-label="Você está em">
        {trilha && trilha.length > 0 ? trilha.map((t, i) => {
          const ultimo = i === trilha.length - 1;
          return (
            <span key={`${t.rotulo}-${i}`} style={{ display: 'contents' }}>
              {ultimo
                ? <span className="rv-tb__crumb-atual" aria-current="page">{t.rotulo}</span>
                : t.onClick
                  ? <button type="button" className="rv-tb__crumb-link" onClick={t.onClick}>{t.rotulo}</button>
                  : <span>{t.rotulo}</span>}
              {!ultimo && <span aria-hidden="true">/</span>}
            </span>
          );
        }) : (
          <>
            <span>{grupo}</span>
            <span aria-hidden="true">/</span>
            <span className="rv-tb__crumb-atual" aria-current="page">{tela}</span>
          </>
        )}
      </nav>

      <div className="rv-tb__esp" />

      <div className="rv-tb__busca" aria-disabled="true" title="Busca global — em breve">
        {IcBusca}
        <span className="rv-tb__busca-txt">Buscar OS, cliente ou placa</span>
        <kbd className="rv-tb__kbd">⌘K</kbd>
      </div>

      <BotaoPrivacidade variante="topbar" />

      <button
        type="button"
        className="rv-tb__btn"
        onClick={() => onNav('alertas')}
        title="Alertas"
        aria-label={total > 0 ? `Ver alertas (${total})` : 'Ver alertas'}
      >
        {IcSino}
        {total > 0 && <span className="rv-tb__badge">{total > 99 ? '99+' : total}</span>}
      </button>

      <div className="rv-tb__usuario" ref={raizRef}>
        <button
          type="button"
          className="rv-tb__user"
          onClick={() => setMenuAberto(v => !v)}
          aria-haspopup="true"
          aria-expanded={menuAberto}
        >
          <span className="rv-tb__avatar" aria-hidden="true">{iniciaisDe(nome)}</span>
          <span className="rv-tb__nome">{primeiroNome}</span>
        </button>
        {menuAberto && (
          <div className="rv-tb__menu">
            <div className="rv-tb__menu-id">
              <div className="rv-tb__menu-nome">{nome}</div>
              {cargo && <div className="rv-tb__menu-cargo">{cargo}</div>}
            </div>
            <button type="button" className="rv-tb__menu-sair" onClick={() => { setMenuAberto(false); logout(); }}>
              {IcSair}
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

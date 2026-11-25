import type { ReactNode } from 'react';
import { Sidebar } from '../features/Dashboard/Navigation';
import { DesktopTopBar } from './DesktopTopBar';
import type { NavPage } from '../types/dashboard';

/**
 * Casco do painel no desktop: sidebar + área principal com a top-bar no topo.
 * É a ÚNICA montagem desse conjunto — as telas só passam o conteúdo. Mexer aqui (ex.: busca
 * global na top-bar, largura da sidebar, rolagem) vale para todas as telas de uma vez.
 *
 * No celular o casco é outro (MobileSafeTop + MobileNav, sem top-bar) e continua em cada tela.
 */
interface Props {
  /** Tela ativa: destaca o item na sidebar e define o breadcrumb da top-bar. */
  page: NavPage;
  onNav: (p: NavPage) => void;
  onNewOS?: () => void;
  /**
   * `false` (padrão): a tela traz o próprio cabeçalho e ocupa a área principal inteira.
   * `true`: o conteúdo vai dentro de um recuo padrão (18px 28px) — telas "sem chrome própria".
   */
  recuo?: boolean;
  children: ReactNode;
}

export function DesktopShell({ page, onNav, onNewOS, recuo = false, children }: Props) {
  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Sidebar active={page} onNav={onNav} onNewOS={onNewOS} />
      <main
        style={{
          flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column',
          background: 'var(--color-bg)',
        }}
      >
        <DesktopTopBar page={page} onNav={onNav} />
        {recuo ? <div style={{ padding: '18px 28px 32px' }}>{children}</div> : children}
      </main>
    </div>
  );
}

/* --- START OF FILE src/features/Dashboard/Alertas/AlertasPage.tsx --- */

import { tokens } from '../../../constants';
import { Sidebar, MobileNav, MobileTopbar } from '../Navigation';
import { DesktopTopBar } from '../../../components/DesktopTopBar';
import { useAlertas } from '../../../hooks/useAlertas';
import { useDestaqueAoChegar } from '../../../hooks/useDestaqueAoChegar';
import type { AcaoAlerta } from '../../../utils/alertas';
import type { NavPage } from '../../../types/dashboard';
import type { Destaque } from '../../../utils/destaque';
import { AlertasDesktop } from './AlertasDesktop';
import { AlertasMobile } from './AlertasMobile';

interface AlertasPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  /** Executa o destino de um alerta (abrir tela, já com busca, ou abrir uma OS). */
  onAcao: (acao: AcaoAlerta) => void;
  /** Vindo de outra tela (ex.: "Ver mais" no Atendimento): rola até o grupo e o faz pulsar. */
  destaque?: Destaque | null;
  onDestaqueConcluido?: () => void;
}

export function AlertasPage({ onNav, isMobile, onNewOS, onAcao, destaque, onDestaqueConcluido }: AlertasPageProps) {
  const { grupos, alertas, escondidos, loading, erro, avisos, recarregar, adiar, dispensar, restaurar, erroAcao, limparErroAcao } = useAlertas();

  // Só procura o alvo depois que os alertas carregaram (antes o grupo ainda não existe no DOM).
  useDestaqueAoChegar(destaque, !loading, onDestaqueConcluido);

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="alertas" onNav={onNav} />
        <AlertasMobile
          grupos={grupos}
          alertas={alertas}
          escondidos={escondidos}
          loading={loading}
          erro={erro}
          avisos={avisos}
          erroAcao={erroAcao}
          onLimparErroAcao={limparErroAcao}
          onVoltar={() => onNav('dashboard')}
          onRecarregar={recarregar}
          onAcao={onAcao}
          onAdiar={adiar}
          onDispensar={dispensar}
          onRestaurar={restaurar}
        />
        <MobileNav active="alertas" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar active="alertas" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
        <DesktopTopBar page="alertas" onNav={onNav} />
        <AlertasDesktop
          grupos={grupos}
          alertas={alertas}
          escondidos={escondidos}
          loading={loading}
          erro={erro}
          avisos={avisos}
          erroAcao={erroAcao}
          onLimparErroAcao={limparErroAcao}
          onRecarregar={recarregar}
          onAcao={onAcao}
          onAdiar={adiar}
          onDispensar={dispensar}
          onRestaurar={restaurar}
        />
      </main>
    </div>
  );
}
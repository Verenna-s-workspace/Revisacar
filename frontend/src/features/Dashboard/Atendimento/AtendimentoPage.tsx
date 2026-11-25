import { useMemo, useState } from 'react';
import { MobileNav, MobileSafeTop } from '../Navigation';
import { DesktopShell } from '../../../components/DesktopShell';
import { useAtendimento } from '../../../hooks/useAtendimento';
import { useEstoque } from '../../../hooks/useEstoque';
import { useServicos } from '../../../hooks/useServicos';
import {
  agendamentoParaPrefill,
  historicoExpressDaOrdem,
  possivelRetornoNaOrdem,
  qtdPecasNaOrdem,
} from '../../../utils/atendimento_utils';
import { AlertaClientesNaoAvisados } from './AlertaClientesNaoAvisados';
import { OSDetalheModal } from './OSDetalheModal';
import { AtendimentoDesktop } from './Desktop/AtendimentoDesktop';
import { AtendimentoMobile } from './Mobile/AtendimentoMobile';
import { PecasNecessarias } from './PecasNecessarias';
import { HistoricoExpress } from './HistoricoExpress';
import type { NavPage } from '../../../types/dashboard';
import type { OSAtendimento, OSPrefillInput } from '../../../types/atendimento';
import type { Agendamento } from '../../../types/agendamento';

interface AtendimentoPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  onLoadOS?: (id: string) => void;
  /** Cria uma OS pré-preenchida e navega pro checklist — ver Seção 8 do prompt. */
  onNewOSComPrefill?: (prefill: OSPrefillInput) => void;
  /** "Ver mais" nos clientes não avisados: abre Alertas já no grupo "Clientes para avisar". */
  onVerClientesNaoAvisados?: () => void;
}

export function AtendimentoPage({ onNav, isMobile, onNewOS, onLoadOS, onNewOSComPrefill, onVerClientesNaoAvisados }: AtendimentoPageProps) {
  const { loading, erro, ordens, agendamentos, colunas, clientesNaoAvisados, proximoAgendamento, atualizarOverlay, garantirIniciado, desbloquear, marcarClienteAvisado } =
    useAtendimento();
  const { kits, itens } = useEstoque();
  const { servicos } = useServicos();

  const [selectedBruto, setSelected] = useState<OSAtendimento | null>(null);
  // O modal sempre mostra a versão mais recente da OS (ex.: "cliente avisado" acabou de mudar).
  const selected = useMemo(
    () => (selectedBruto ? ordens.find(o => o.id === selectedBruto.id) ?? selectedBruto : null),
    [selectedBruto, ordens],
  );

  // ordemId -> nº de itens de peça vinculados via Kit (chip do card + seção do modal).
  const qtdPecasPorOrdem = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const ordem of ordens) {
      const qtd = qtdPecasNaOrdem(ordem, kits, servicos);
      if (qtd > 0) mapa[ordem.id] = qtd;
    }
    return mapa;
  }, [ordens, kits, servicos]);

  // ordemId -> possível retorno (mesmo Histórico Express, olhando pra lista toda).
  const possivelRetornoPorOrdem = useMemo(() => {
    const mapa: Record<string, boolean> = {};
    for (const ordem of ordens) {
      const historico = historicoExpressDaOrdem(ordem, ordens);
      if (possivelRetornoNaOrdem(ordem, historico)) mapa[ordem.id] = true;
    }
    return mapa;
  }, [ordens]);

  // ── handlers ────────────────────────────────────────────────────────────────

  const handleIniciarAtendimento = (agendamento: Agendamento) => {
    onNewOSComPrefill?.(agendamentoParaPrefill(agendamento));
  };

  const handleContinuarChecklist = (ordem: OSAtendimento) => {
    garantirIniciado(ordem.id);
    setSelected(null);
    onLoadOS?.(ordem.id);
  };

  // ── modal ───────────────────────────────────────────────────────────────────

  const modals = selected && (
    <OSDetalheModal
      ordem={selected}
      onClose={() => setSelected(null)}
      onContinuarChecklist={() => handleContinuarChecklist(selected)}
      onAtualizarOverlay={atualizarOverlay}
      onDesbloquear={desbloquear}
      onClienteAvisado={marcarClienteAvisado}
    >
      <PecasNecessarias ordem={selected} kits={kits} itens={itens} servicos={servicos} />
      <HistoricoExpress ordem={selected} todasOrdens={ordens} />
    </OSDetalheModal>
  );

  // ── layout ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileSafeTop />
        <AtendimentoMobile
          colunas={colunas}
          agendamentos={agendamentos}
          // Skeleton só na primeira carga: recarregar depois de uma ação não deve piscar o quadro.
          loading={loading && ordens.length === 0}
          erro={erro}
          clientesNaoAvisados={clientesNaoAvisados}
          proximoAgendamento={proximoAgendamento}
          qtdPecasPorOrdem={qtdPecasPorOrdem}
          possivelRetornoPorOrdem={possivelRetornoPorOrdem}
          onVoltar={() => onNav('dashboard')}
          onAbrirOS={setSelected}
          onContinuarChecklist={handleContinuarChecklist}
          onPecaChegou={desbloquear}
          onIniciarAtendimento={handleIniciarAtendimento}
          onVerClientesNaoAvisados={onVerClientesNaoAvisados}
        />
        <MobileNav active="atendimento" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
        {modals}
      </div>
    );
  }

  return (
    <>
      <DesktopShell page="atendimento" onNav={onNav} onNewOS={onNewOS}>
        <AtendimentoDesktop
          colunas={colunas}
          agendamentos={agendamentos}
          // Skeleton só na primeira carga: recarregar depois de uma ação não deve piscar o quadro.
          loading={loading && ordens.length === 0}
          erro={erro}
          clientesNaoAvisados={clientesNaoAvisados}
          proximoAgendamento={proximoAgendamento}
          qtdPecasPorOrdem={qtdPecasPorOrdem}
          possivelRetornoPorOrdem={possivelRetornoPorOrdem}
          onAbrirOS={setSelected}
          onIniciarAtendimento={handleIniciarAtendimento}
          onVerClientesNaoAvisados={onVerClientesNaoAvisados}
        />
      </DesktopShell>
      {modals}
    </>
  );
}
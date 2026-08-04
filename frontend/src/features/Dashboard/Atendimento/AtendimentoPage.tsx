import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Sidebar, MobileNav } from '../Navigation';
import { useAtendimento } from '../../../hooks/useAtendimento';
import { useEstoque } from '../../../hooks/useEstoque';
import { useServicos } from '../../../hooks/useServicos';
import {
  agendamentoParaPrefill,
  historicoExpressDaOrdem,
  possivelRetornoNaOrdem,
  qtdPecasNaOrdem,
} from '../../../utils/atendimento_utils';
import { ResumoOperacional } from './ResumoOperacional';
import { ProximoAgendamento } from './ProximoAgendamento';
import { AlertaClientesNaoAvisados } from './AlertaClientesNaoAvisados';
import { KanbanBoard } from './KanbanBoard';
import { OSDetalheModal } from './OSDetalheModal';
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
}

export function AtendimentoPage({ onNav, isMobile, onNewOS, onLoadOS, onNewOSComPrefill }: AtendimentoPageProps) {
  const { loading, ordens, colunas, resumo, clientesNaoAvisados, proximoAgendamento, atualizarOverlay, garantirIniciado } =
    useAtendimento();
  const { kits, itens } = useEstoque();
  const { servicos } = useServicos();

  const [selected, setSelected] = useState<OSAtendimento | null>(null);

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

  // ── conteúdo ────────────────────────────────────────────────────────────────

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>
      {/* header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: isMobile ? '14px 16px' : '16px 28px',
          background: 'white',
          borderBottom: `1px solid ${tokens.color.border}`,
          flexShrink: 0,
        }}
      >
        {isMobile && (
          <button
            onClick={() => onNav('dashboard')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 4 }}
          >
            {Icons.chevL}
          </button>
        )}
        <div>
          <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.3rem', color: tokens.color.text, margin: 0 }}>
            Atendimento
          </h2>
          <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
            Painel operacional do mecânico — fila, execução e pendências de hoje.
          </p>
        </div>
      </div>

      {/* corpo */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: isMobile ? '12px 12px 32px' : '18px 28px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Resumo + Próximo Agendamento — faixas menores, tamanhos diferentes entre si (Seção 9) */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.85fr 1.15fr', gap: 14 }}>
          <ResumoOperacional resumo={resumo} loading={loading} />
          <ProximoAgendamento agendamento={proximoAgendamento} loading={loading} onIniciarAtendimento={handleIniciarAtendimento} />
        </div>

        <AlertaClientesNaoAvisados clientes={clientesNaoAvisados} onAbrirOS={setSelected} />

        {/* Kanban — ocupa a largura toda, é o conteúdo principal (Seção 9) */}
        <KanbanBoard
          colunas={colunas}
          isMobile={isMobile}
          qtdPecasPorOrdem={qtdPecasPorOrdem}
          possivelRetornoPorOrdem={possivelRetornoPorOrdem}
          onAbrirOS={setSelected}
          onIniciarAtendimento={handleIniciarAtendimento}
        />
      </div>
    </div>
  );

  // ── modal ───────────────────────────────────────────────────────────────────

  const modals = selected && (
    <OSDetalheModal
      ordem={selected}
      onClose={() => setSelected(null)}
      onContinuarChecklist={() => handleContinuarChecklist(selected)}
      onAtualizarOverlay={atualizarOverlay}
    >
      <PecasNecessarias ordem={selected} kits={kits} itens={itens} servicos={servicos} />
      <HistoricoExpress ordem={selected} todasOrdens={ordens} />
    </OSDetalheModal>
  );

  // ── layout ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="atendimento" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
        {modals}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="atendimento" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{content}</main>
      {modals}
    </div>
  );
}

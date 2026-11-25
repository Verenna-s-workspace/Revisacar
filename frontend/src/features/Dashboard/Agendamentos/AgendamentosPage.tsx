import { useState, useMemo, useCallback, useEffect } from 'react';
import { MobileNav, MobileSafeTop } from '../Navigation';
import { DesktopShell } from '../../../components/DesktopShell';
import { useAgendamentos } from '../../../hooks/useAgendamentos';
import type { NavPage } from '../../../types/dashboard';
import type {
  Agendamento,
  AppointmentStatus,
  AgendaViewMode,
  AgendaFiltros,
  NovoAgendamentoInput,
} from '../../../types/agendamento';
import { toISODate, isSameMonth, parseISODate, addDays, duracaoEmMinutos } from '../../../utils/agenda';
import { inicioDaSemana } from './agendamentosDesktopUtils';

// Sub-components
import { AgendamentosDesktop } from './AgendamentosDesktop';
import { AgendamentoFiltrosModal, FILTROS_PADRAO } from './AgendamentoFiltrosModal';
import { AppointmentModal } from './AppointmentModal';
import { NewAppointmentModal } from './NewAppointmentModal';
import { AjustarHorarioModal } from './AjustarHorarioModal';
import { AgendaMobile } from './mobile/AgendaMobile';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgendamentosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  /** Pré-preenche a busca (ex.: vindo da badge "Agendado" no card de um cliente). */
  initialSearch?: string;
  /** Abre automaticamente o detalhe deste agendamento assim que a lista carregar. */
  initialHighlightId?: string;
  /** Abre o modal de novo agendamento ao chegar (botão "Agendar" da Visão Geral). */
  initialNovo?: boolean;
}

// ── Filter logic ──────────────────────────────────────────────────────────────

function applyFilters(
  list: Agendamento[],
  search: string,
  filtros: AgendaFiltros,
  /** Desktop: a semana vai de segunda a domingo (como na grade). Mobile segue de domingo a sábado. */
  semanaComecaNaSegunda = false,
): Agendamento[] {
  const todayISO = toISODate(new Date());
  const today = new Date();

  return list.filter(ag => {
    if (filtros.status !== 'todos' && ag.status !== filtros.status) return false;

    if (filtros.periodo !== 'todos') {
      if (filtros.periodo === 'hoje' && ag.data !== todayISO) return false;
      if (filtros.periodo === 'semana') {
        const d = parseISODate(ag.data);
        let start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        start.setHours(0, 0, 0, 0);
        if (semanaComecaNaSegunda) start = inicioDaSemana(today);
        const end = addDays(start, 6);
        if (d < start || d > end) return false;
      }
      if (filtros.periodo === 'mes' && !isSameMonth(parseISODate(ag.data), today)) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      return (
        ag.cliente.toLowerCase().includes(q) ||
        ag.placa.toLowerCase().includes(q) ||
        ag.veiculo.toLowerCase().includes(q) ||
        ag.titulo.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

// ── AgendamentosPage ─────────────────────────────────────────────────────────

export function AgendamentosPage({ onNav, isMobile, onNewOS, initialSearch, initialHighlightId, initialNovo }: AgendamentosPageProps) {
  const {
    agendamentos, loading, usingApi, erro,
    addAgendamento, updateAgendamento, updateStatus, cancelAgendamento,
    rescheduleAgendamento, getOcupados,
  } = useAgendamentos();

  const [viewMode, setViewMode]       = useState<AgendaViewMode>(isMobile ? 'diario' : 'semanal');
  const [viewDate, setViewDate]       = useState(() => new Date());
  const [search,   setSearch]         = useState(initialSearch ?? '');
  const [filtros,  setFiltros]        = useState<AgendaFiltros>(FILTROS_PADRAO);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [selectedAg, setSelectedAg]   = useState<Agendamento | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(!!initialNovo);
  const [newModalDate,  setNewModalDate] = useState<string | undefined>(undefined);
  const [rescheduleId,  setRescheduleId] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<{ ag: Agendamento; modo: 'ajustar' | 'confirmar' } | null>(null);

  // Vindo do perfil de um cliente (badge "Agendado" ou item da aba Agendamentos):
  // assim que a lista carregar, abre direto o detalhe daquele agendamento.
  useEffect(() => {
    if (!initialHighlightId || loading) return;
    const alvo = agendamentos.find(a => a.id === initialHighlightId);
    if (alvo) setSelectedAg(alvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialHighlightId]);

  const filtered = useMemo(
    () => applyFilters(agendamentos, search, filtros, !isMobile),
    [agendamentos, search, filtros, isMobile],
  );

  const showList = filtros.status !== 'todos' || filtros.periodo !== 'todos' || search.length > 0;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openNewModal = useCallback((date?: string) => {
    setNewModalDate(date);
    setNewModalOpen(true);
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setViewDate(date);
    setViewMode('diario');
  }, []);

  const handleReschedule = useCallback((id: string) => {
    setSelectedAg(null);
    setRescheduleId(id);
    openNewModal();
  }, [openNewModal]);

  const avisarErro = (e: unknown) => window.alert(e instanceof Error ? e.message : 'Não foi possível concluir a operação. Atualize a página e tente de novo.');

  const handleNewConfirm = useCallback(async (input: NovoAgendamentoInput) => {
    try {
      if (rescheduleId) {
        rescheduleAgendamento(rescheduleId, input.data, input.horaInicio, duracaoEmMinutos(input.horaInicio, input.horaFim));
        setRescheduleId(null);
      } else {
        await addAgendamento(input);
      }
      setViewDate(parseISODate(input.data));
      if (viewMode === 'mensal') setViewMode('diario');
    } catch (err) {
      // Não deveria acontecer pelo seletor de horário (só oferece slots
      // válidos), mas evita um erro não tratado se chegar aqui mesmo assim.
      window.alert(err instanceof Error ? err.message : 'Não foi possível salvar o agendamento. Confira cliente, data e horário e tente de novo.');
    }
  }, [addAgendamento, rescheduleAgendamento, rescheduleId, viewMode]);

  // ── Modals ───────────────────────────────────────────────────────────────────

  const modals = (
    <>
      {selectedAg && (
        <AppointmentModal
          agendamento={selectedAg}
          onClose={() => setSelectedAg(null)}
          onEdit={ag => { setSelectedAg(null); setAjuste({ ag, modo: 'ajustar' }); }}
          onConfirmar={ag => { setSelectedAg(null); setAjuste({ ag, modo: 'confirmar' }); }}
          onReschedule={handleReschedule}
          onCancel={id => { cancelAgendamento(id).catch(avisarErro); setSelectedAg(null); }}
          onStatusChange={(id, status) => { updateStatus(id, status).catch(avisarErro); setSelectedAg(null); }}
        />
      )}
      {ajuste && (
        <AjustarHorarioModal
          agendamento={ajuste.ag}
          modo={ajuste.modo}
          getOcupados={getOcupados}
          onSave={changes => updateAgendamento(ajuste.ag.id, changes)}
          onClose={() => setAjuste(null)}
        />
      )}
      {!isMobile && filtrosAbertos && (
        <AgendamentoFiltrosModal
          filtros={filtros}
          onApply={setFiltros}
          onClose={() => setFiltrosAbertos(false)}
        />
      )}
      {newModalOpen && (
        <NewAppointmentModal
          reagendando={rescheduleId ? agendamentos.find(a => a.id === rescheduleId) : undefined}
          initialDate={newModalDate}
          getOcupados={getOcupados}
          onConfirm={handleNewConfirm}
          onClose={() => { setNewModalOpen(false); setNewModalDate(undefined); setRescheduleId(null); }}
        />
      )}
    </>
  );

  // ── Layout ───────────────────────────────────────────────────────────────────

  if (isMobile) {
    // Mobile: layout próprio (pasta ./mobile), com as visões Dia/Semana/Mês, lista com busca/filtros e filtros em bottom sheet.
    // O desktop abaixo permanece exatamente como estava.
    return (
      <div className="agm-shell" style={{ minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileSafeTop />
        <AgendaMobile
          agendamentos={filtered}
          total={agendamentos.length}
          loading={loading}
          erro={erro}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          viewDate={viewDate}
          onViewDateChange={setViewDate}
          search={search}
          onSearchChange={setSearch}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          onCardClick={setSelectedAg}
          onNew={openNewModal}
          onDayClick={handleDayClick}
        />
        <MobileNav active="agendamentos" onNav={onNav} onNewOS={onNewOS ?? (() => openNewModal())} />
        {modals}
      </div>
    );
  }

  // Desktop: cabeçalho, busca/filtros e calendário ou lista (./AgendamentosDesktop).
  // A página inteira rola junto (como Estoque, Veículos e Ordens), tanto no calendário quanto na lista.
  return (
    <>
      <DesktopShell page="agendamentos" onNav={onNav} onNewOS={onNewOS}>
        <AgendamentosDesktop
          agendamentos={filtered}
          total={agendamentos.length}
          loading={loading}
          erro={erro}
          viewMode={viewMode}
          onViewMode={setViewMode}
          viewDate={viewDate}
          onViewDate={setViewDate}
          search={search}
          onSearch={setSearch}
          filtros={filtros}
          onFiltros={setFiltros}
          emLista={showList}
          onOpenFilters={() => setFiltrosAbertos(true)}
          onNovo={() => openNewModal()}
          onCardClick={setSelectedAg}
          onDayClick={handleDayClick}
        />
      </DesktopShell>
      {modals}
    </>
  );
}

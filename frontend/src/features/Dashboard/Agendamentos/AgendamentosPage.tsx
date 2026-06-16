import { useState, useMemo, useCallback } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { AgendaIcons } from './icons';
import { Sidebar, MobileNav } from '../Navigation';
import { Skeleton } from '../Primitives';
import { useResponsive } from '../../../components/ui';
import { useAgendamentos } from '../../../hooks/useAgendamentos';
import type { NavPage } from '../../../types/dashboard';
import type {
  Agendamento,
  AppointmentStatus,
  AgendaViewMode,
  AgendaFiltros,
  NovoAgendamentoInput,
} from '../../../types/agendamento';
import { toISODate, isSameMonth, parseISODate, addDays } from '../../../utils/agenda';

// Sub-components
import { AppointmentStats } from './AppointmentStats';
import { AppointmentFilters } from './AppointmentFilters';
import { DailyView } from './DailyView';
import { WeeklyView } from './WeeklyView';
import { MonthlyView } from './MonthlyView';
import { AppointmentCard } from './AppointmentCard';
import { AppointmentModal } from './AppointmentModal';
import { NewAppointmentModal } from './NewAppointmentModal';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgendamentosPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
}

// ── Filter logic ──────────────────────────────────────────────────────────────

function applyFilters(list: Agendamento[], search: string, filtros: AgendaFiltros): Agendamento[] {
  const todayISO = toISODate(new Date());
  const today = new Date();

  return list.filter(ag => {
    if (filtros.status !== 'todos' && ag.status !== filtros.status) return false;

    if (filtros.periodo !== 'todos') {
      if (filtros.periodo === 'hoje' && ag.data !== todayISO) return false;
      if (filtros.periodo === 'semana') {
        const d = parseISODate(ag.data);
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        start.setHours(0, 0, 0, 0);
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

// ── View mode switcher ────────────────────────────────────────────────────────

const VIEW_OPTS: { mode: AgendaViewMode; icon: JSX.Element; label: string }[] = [
  { mode: 'diario',  icon: AgendaIcons.viewDay,   label: 'Diário'  },
  { mode: 'semanal', icon: AgendaIcons.viewWeek,  label: 'Semanal' },
  { mode: 'mensal',  icon: AgendaIcons.viewMonth, label: 'Mensal'  },
];

function ViewSwitcher({ active, onChange }: { active: AgendaViewMode; onChange: (m: AgendaViewMode) => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: tokens.color.surfaceHigh, borderRadius: 10, padding: 3,
      }}
    >
      {VIEW_OPTS.map(o => (
        <button
          key={o.mode}
          onClick={() => onChange(o.mode)}
          title={o.label}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, border: 'none',
            background: active === o.mode ? 'white' : 'transparent',
            color: active === o.mode ? tokens.color.ferrari : tokens.color.muted,
            fontWeight: active === o.mode ? 700 : 500,
            fontSize: '0.78rem', cursor: 'pointer',
            boxShadow: active === o.mode ? tokens.shadow.xs : 'none',
            transition: 'all 0.15s ease', fontFamily: tokens.fontSans,
          }}
        >
          <span style={{ display: 'flex' }}>{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── AgendamentosPage ─────────────────────────────────────────────────────────

export function AgendamentosPage({ onNav, isMobile, onNewOS }: AgendamentosPageProps) {
  const {
    agendamentos, loading, stats,
    addAgendamento, updateStatus, cancelAgendamento,
    rescheduleAgendamento, getOcupados,
  } = useAgendamentos();

  const [viewMode, setViewMode]       = useState<AgendaViewMode>('diario');
  const [viewDate, setViewDate]       = useState(() => new Date());
  const [search,   setSearch]         = useState('');
  const [filtros,  setFiltros]        = useState<AgendaFiltros>({ status: 'todos', periodo: 'todos' });
  const [selectedAg, setSelectedAg]   = useState<Agendamento | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newModalDate,  setNewModalDate] = useState<string | undefined>(undefined);
  const [rescheduleId,  setRescheduleId] = useState<string | null>(null);

  const filtered = useMemo(
    () => applyFilters(agendamentos, search, filtros),
    [agendamentos, search, filtros],
  );

  const showList = isMobile || filtros.status !== 'todos' || filtros.periodo !== 'todos' || search.length > 0;

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

  const handleNewConfirm = useCallback(async (input: NovoAgendamentoInput) => {
    if (rescheduleId) {
      rescheduleAgendamento(rescheduleId, input.data, input.horaInicio);
      setRescheduleId(null);
    } else {
      await addAgendamento(input);
    }
    setViewDate(parseISODate(input.data));
    if (viewMode === 'mensal') setViewMode('diario');
  }, [addAgendamento, rescheduleAgendamento, rescheduleId, viewMode]);

  // ── Content ─────────────────────────────────────────────────────────────────

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>

      {/* ── Page header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '14px 16px' : '16px 28px',
        background: 'white', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0,
        flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              Agendamentos
            </h2>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
              {loading ? 'Carregando...' : `${agendamentos.length} agendamentos no total`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!isMobile && (
            <ViewSwitcher active={viewMode} onChange={setViewMode} />
          )}
          <button
            onClick={() => openNewModal()}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: isMobile ? '8px 14px' : '9px 18px',
              background: tokens.color.ferrari, color: 'white',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: '0.84rem', fontWeight: 700, boxShadow: tokens.shadow.sm,
              fontFamily: tokens.fontSans,
            }}
          >
            <span style={{ display: 'flex' }}>{Icons.plus}</span>
            {isMobile ? 'Novo' : 'Novo Agendamento'}
          </button>
        </div>
      </div>

      {/* ── Filters ─── */}
      <AppointmentFilters
        search={search}
        filtros={filtros}
        onSearch={setSearch}
        onFiltros={setFiltros}
      />

      {/* ── Mobile view switcher ─── */}
      {isMobile && (
        <div style={{ padding: '10px 14px', background: 'white', borderBottom: `1px solid ${tokens.color.border}` }}>
          <ViewSwitcher active={viewMode} onChange={setViewMode} />
        </div>
      )}

      {/* ── Body ─── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: isMobile ? '12px 12px 32px' : '18px 28px 36px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Stats cards */}
        <AppointmentStats stats={stats} loading={loading} />

        {loading ? (
          <Skeleton h={420} r={16} />
        ) : (
          <>
            {/* Calendar views */}
            {!showList && viewMode === 'diario' && (
              <DailyView
                date={viewDate}
                agendamentos={filtered}
                onDateChange={setViewDate}
                onCardClick={setSelectedAg}
              />
            )}
            {!showList && viewMode === 'semanal' && (
              <WeeklyView
                date={viewDate}
                agendamentos={filtered}
                onDateChange={setViewDate}
                onCardClick={setSelectedAg}
                onDayClick={handleDayClick}
              />
            )}
            {!showList && viewMode === 'mensal' && (
              <MonthlyView
                date={viewDate}
                agendamentos={filtered}
                onDateChange={setViewDate}
                onDayClick={d => {
                  if (viewMode === 'mensal') {
                    handleDayClick(d);
                  } else {
                    openNewModal(toISODate(d));
                  }
                }}
              />
            )}

            {/* List view (mobile, search, or filters active) */}
            {showList && filtered.length > 0 && (
              <div
                style={{
                  background: 'white', borderRadius: 14,
                  border: `1px solid ${tokens.color.border}`,
                  boxShadow: tokens.shadow.xs, overflow: 'hidden',
                }}
              >
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${tokens.color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: tokens.color.text }}>Lista de Agendamentos</div>
                  <span style={{ fontSize: '0.72rem', color: tokens.color.muted }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filtered.map(ag => (
                    <AppointmentCard key={ag.id} agendamento={ag} variant="large" onClick={() => setSelectedAg(ag)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 12, padding: '60px 20px',
                  background: 'white', borderRadius: 16,
                  border: `1px solid ${tokens.color.border}`,
                }}
              >
                <div style={{ fontSize: '3rem', opacity: 0.18 }}>📅</div>
                <div style={{ fontWeight: 700, color: tokens.color.text, fontSize: '1rem' }}>
                  Nenhum agendamento encontrado
                </div>
                <div style={{ fontSize: '0.84rem', color: tokens.color.muted, textAlign: 'center', maxWidth: 280 }}>
                  Ajuste os filtros ou crie um novo agendamento.
                </div>
                <button
                  onClick={() => openNewModal()}
                  style={{
                    marginTop: 4, padding: '10px 22px',
                    background: tokens.color.ferrari, color: 'white',
                    border: 'none', borderRadius: 10, cursor: 'pointer',
                    fontSize: '0.875rem', fontWeight: 600, fontFamily: tokens.fontSans,
                  }}
                >
                  + Novo Agendamento
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Modals ───────────────────────────────────────────────────────────────────

  const modals = (
    <>
      {selectedAg && (
        <AppointmentModal
          agendamento={selectedAg}
          onClose={() => setSelectedAg(null)}
          onEdit={ag => { setSelectedAg(null); openNewModal(ag.data); }}
          onReschedule={handleReschedule}
          onCancel={id => { cancelAgendamento(id); setSelectedAg(null); }}
          onStatusChange={(id, status) => { updateStatus(id, status); setSelectedAg(null); }}
        />
      )}
      {newModalOpen && (
        <NewAppointmentModal
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
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="agendamentos" onNav={onNav} onNewOS={onNewOS ?? (() => openNewModal())} />
        {modals}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="agendamentos" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {content}
      </main>
      {modals}
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';
import './agendaMobile.css';
import { Icons } from '../../Icons';
import { AgendaIcons } from '../icons';
import { Skeleton } from '../../Primitives';
import { MobileStatsRail } from './MobileStatsRail';
import { MobileDailyView } from './MobileDailyView';
import { MobileWeeklyView } from './MobileWeeklyView';
import { MobileMonthlyView } from './MobileMonthlyView';
import { MobileAppointmentCard } from './MobileAppointmentCard';
import { MobileFiltersSheet } from './MobileFiltersSheet';
import { toISODate, parseISODate, WEEKDAYS_LONG, MONTHS } from '../../../../utils/agenda';
import type { AgendamentoStats } from '../../../../hooks/useAgendamentos';
import type {
  Agendamento,
  AgendaFiltros,
  AgendaPeriodo,
  AgendaViewMode,
} from '../../../../types/agendamento';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AgendaMobileProps {
  /** Lista já filtrada (busca + período + status). */
  agendamentos: Agendamento[];
  /** Total sem filtros — usado só no subtítulo do cabeçalho. */
  total: number;
  loading: boolean;
  erro: string | null;
  stats: AgendamentoStats;
  viewMode: AgendaViewMode;
  onViewModeChange: (m: AgendaViewMode) => void;
  viewDate: Date;
  onViewDateChange: (d: Date) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filtros: AgendaFiltros;
  onFiltrosChange: (f: AgendaFiltros) => void;
  onBack: () => void;
  onCardClick: (ag: Agendamento) => void;
  /** Abre o modal de novo agendamento (data opcional, ISO). */
  onNew: (isoDate?: string) => void;
  /** Mensal → toque em um dia com agendamentos. */
  onDayClick: (d: Date) => void;
}

const PERIOD_OPTS: { val: AgendaPeriodo; label: string }[] = [
  { val: 'todos',  label: 'Todos' },
  { val: 'hoje',   label: 'Hoje' },
  { val: 'semana', label: 'Esta semana' },
  { val: 'mes',    label: 'Este mês' },
];

const VIEW_OPTS: { mode: AgendaViewMode; label: string; icon: JSX.Element }[] = [
  { mode: 'diario',  label: 'Diário',  icon: AgendaIcons.viewDay },
  { mode: 'semanal', label: 'Semanal', icon: AgendaIcons.viewWeek },
  { mode: 'mensal',  label: 'Mensal',  icon: AgendaIcons.viewMonth },
];

// ── Componente ────────────────────────────────────────────────────────────────

export function AgendaMobile({
  agendamentos, total, loading, erro, stats,
  viewMode, onViewModeChange, viewDate, onViewDateChange,
  search, onSearchChange, filtros, onFiltrosChange,
  onBack, onCardClick, onNew, onDayClick,
}: AgendaMobileProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const query = search.trim();
  const searching = query.length > 0;
  const hasFilters = filtros.status !== 'todos' || filtros.periodo !== 'todos';

  const setPeriodo = (periodo: AgendaPeriodo) => {
    onFiltrosChange({ ...filtros, periodo });
    // O período é relativo a hoje: leva a visão para hoje para o resultado aparecer.
    if (periodo !== 'todos') onViewDateChange(new Date());
  };

  const clearFilters = () => onFiltrosChange({ status: 'todos', periodo: 'todos' });

  // FAB: usa o dia que a pessoa está olhando, desde que não seja passado.
  const handleFab = () => {
    const iso = toISODate(viewDate);
    onNew(viewMode !== 'mensal' && iso >= toISODate(new Date()) ? iso : undefined);
  };

  // Resultados da busca: todos os dias, agrupados por data.
  const groups = useMemo(() => {
    if (!searching) return [];
    const sorted = [...agendamentos].sort((a, b) =>
      a.data === b.data ? a.horaInicio.localeCompare(b.horaInicio) : a.data < b.data ? -1 : 1);
    const map = new Map<string, Agendamento[]>();
    sorted.forEach(a => map.set(a.data, [...(map.get(a.data) ?? []), a]));
    return [...map.entries()];
  }, [agendamentos, searching]);

  return (
    <div className="agm">
      {/* ── Cabeçalho: título, busca, filtros, períodos ─── */}
      <header className="agm-header">
        <div className="agm-header__row">
          <button type="button" className="agm-back" onClick={onBack} aria-label="Voltar ao início">
            {Icons.chevL}
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 className="agm-title">Agendamentos</h1>
            <p className="agm-subtitle">
              {loading ? 'Carregando…' : `${total} agendamento${total !== 1 ? 's' : ''} no total`}
            </p>
          </div>
        </div>

        <div className="agm-search-row">
          <label className="agm-search">
            <span className="agm-search__icon" aria-hidden="true">{Icons.search}</span>
            <input
              className="agm-search__input"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="busca_agendamentos"
              aria-label="Buscar por cliente ou placa"
              placeholder="Cliente ou placa..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
            />
            {search && (
              <button type="button" className="agm-search__clear" aria-label="Limpar busca" onClick={() => onSearchChange('')}>
                ×
              </button>
            )}
          </label>
          <button
            type="button"
            className={`agm-filterbtn${filtros.status !== 'todos' ? ' is-active' : ''}`}
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
          >
            {AgendaIcons.filter}
            Filtros
            {filtros.status !== 'todos' && <span className="agm-filterbtn__dot" aria-hidden="true" />}
          </button>
        </div>

        <div className="agm-chips" role="group" aria-label="Período">
          {PERIOD_OPTS.map(o => (
            <button
              key={o.val}
              type="button"
              className={`agm-chip-btn${filtros.periodo === o.val ? ' is-active' : ''}`}
              aria-pressed={filtros.periodo === o.val}
              onClick={() => setPeriodo(o.val)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      {erro && <div className="agm-error" role="alert">{erro}</div>}

      <MobileStatsRail stats={stats} loading={loading} />

      {/* ── Seletor de visão ─── */}
      {!searching && (
      <div className="agm-tabs-wrap">
        <div className="agm-tabs" role="tablist" aria-label="Visão da agenda">
          {VIEW_OPTS.map(o => (
            <button
              key={o.mode}
              type="button"
              role="tab"
              aria-selected={viewMode === o.mode}
              className={`agm-tab${viewMode === o.mode ? ' is-active' : ''}`}
              onClick={() => onViewModeChange(o.mode)}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── Conteúdo ─── */}
      <main className="agm-body">
        {loading ? (
          <>
            <Skeleton h={72} r={16} />
            <Skeleton h={220} r={16} />
          </>
        ) : searching ? (
          <div className="agm-view" key="busca">
            <p className="agm-subtitle" role="status">
              {agendamentos.length} resultado{agendamentos.length !== 1 ? 's' : ''} para “{query}”
            </p>
            {groups.length === 0 ? (
              <div className="agm-empty">
                <p className="agm-empty__title">Nada encontrado</p>
                <p className="agm-empty__text">Confira o nome do cliente ou a placa, ou limpe os filtros.</p>
                <button type="button" className="agm-btn agm-btn--ghost" onClick={() => { onSearchChange(''); clearFilters(); }}>
                  Limpar busca e filtros
                </button>
              </div>
            ) : (
              groups.map(([iso, list]) => {
                const d = parseISODate(iso);
                return (
                  <section key={iso} className="agm-group">
                    <h2 className="agm-group__title">{WEEKDAYS_LONG[d.getDay()]}, {d.getDate()} de {MONTHS[d.getMonth()]}</h2>
                    <ul className="agm-list">
                      {list.map(ag => (
                        <li key={ag.id}><MobileAppointmentCard agendamento={ag} onClick={() => onCardClick(ag)} /></li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        ) : (
          <div key={viewMode} style={{ display: 'contents' }}>
            {viewMode === 'diario' && (
              <MobileDailyView
                date={viewDate}
                agendamentos={agendamentos}
                onDateChange={onViewDateChange}
                onCardClick={onCardClick}
                onNew={onNew}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
              />
            )}
            {viewMode === 'semanal' && (
              <MobileWeeklyView
                date={viewDate}
                agendamentos={agendamentos}
                onDateChange={onViewDateChange}
                onCardClick={onCardClick}
                onNew={onNew}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
              />
            )}
            {viewMode === 'mensal' && (
              <MobileMonthlyView
                date={viewDate}
                agendamentos={agendamentos}
                onDateChange={onViewDateChange}
                onDayClick={onDayClick}
              />
            )}
          </div>
        )}
      </main>

      {/* ── FAB: ação rápida fixa no canto inferior direito ─── */}
      <button type="button" className="agm-fab" onClick={handleFab}>
        {Icons.plus}
        Novo Agendamento
      </button>

      <MobileFiltersSheet
        open={sheetOpen}
        status={filtros.status}
        onStatusChange={status => onFiltrosChange({ ...filtros, status })}
        onClose={closeSheet}
      />
    </div>
  );
}

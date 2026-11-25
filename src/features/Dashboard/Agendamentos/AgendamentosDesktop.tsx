import { useEffect, useMemo, useRef } from 'react';
import { Skeleton } from '../Primitives';
import { addDays, addMonths, toISODate } from '../../../utils/agenda';
import type { Agendamento, AgendaFiltros, AgendaViewMode } from '../../../types/agendamento';
import { AgendaGrade } from './AgendaGrade';
import { AgendaMes } from './AgendaMes';
import { AgendamentoLista } from './AgendamentoLista';
import { contarFiltros, FILTROS_PADRAO, PERIODOS } from './AgendamentoFiltrosModal';
import { APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import {
  diasDaSemana,
  plural,
  rotuloDia,
  rotuloIntervalo,
  rotuloMes,
} from './agendamentosDesktopUtils';
import { IcAlerta, IcBuscar, IcFechar, IcFiltros, IcMais, IcSetaDir, IcSetaEsq } from './icones';
import '../Ordens/Status.css';
import './agendamentosDesktop.css';

const VISOES: { modo: AgendaViewMode; rotulo: string }[] = [
  { modo: 'diario', rotulo: 'Dia' },
  { modo: 'semanal', rotulo: 'Semana' },
  { modo: 'mensal', rotulo: 'Mês' },
];

const NOME_PERIODO = (anterior: boolean, modo: AgendaViewMode) =>
  `${anterior ? 'Anterior' : 'Próximo'}: ${modo === 'diario' ? 'dia' : modo === 'semanal' ? 'semana' : 'mês'}`;

interface AgendamentosDesktopProps {
  /** Já com busca e filtros aplicados. */
  agendamentos: Agendamento[];
  total: number;
  loading: boolean;
  erro: string | null;
  viewMode: AgendaViewMode;
  onViewMode: (m: AgendaViewMode) => void;
  viewDate: Date;
  onViewDate: (d: Date) => void;
  search: string;
  onSearch: (v: string) => void;
  filtros: AgendaFiltros;
  onFiltros: (f: AgendaFiltros) => void;
  /** Com busca/filtros ativos a tela mostra a lista no lugar do calendário. */
  emLista: boolean;
  onOpenFilters: () => void;
  onNovo: () => void;
  onCardClick: (ag: Agendamento) => void;
  onDayClick: (d: Date) => void;
}

export function AgendamentosDesktop({
  agendamentos, total, loading, erro,
  viewMode, onViewMode, viewDate, onViewDate,
  search, onSearch, filtros, onFiltros,
  emLista, onOpenFilters, onNovo, onCardClick, onDayClick,
}: AgendamentosDesktopProps) {
  const buscaRef = useRef<HTMLInputElement>(null);

  const qtdFiltros = contarFiltros(filtros);
  const temFiltros = qtdFiltros > 0 || search.trim().length > 0;

  // Atalho "/" foca a busca (mesmo padrão de Ordens, Estoque e Veículos).
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      buscaRef.current?.focus();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  // Dias exibidos: segunda a sábado; o domingo só aparece quando tem agendamento ou é hoje.
  const diasSemana = useMemo(() => {
    const sete = diasDaSemana(viewDate);
    const domingo = sete[6];
    const iso = toISODate(domingo);
    const temDomingo = iso === toISODate(new Date()) || agendamentos.some(a => a.data === iso);
    return temDomingo ? sete : sete.slice(0, 6);
  }, [viewDate, agendamentos]);

  const diasDaGrade = useMemo(() => (viewMode === 'diario' ? [viewDate] : diasSemana), [viewMode, viewDate, diasSemana]);

  const mover = (direcao: -1 | 1) => {
    if (viewMode === 'diario') onViewDate(addDays(viewDate, direcao));
    else if (viewMode === 'semanal') onViewDate(addDays(viewDate, 7 * direcao));
    else onViewDate(addMonths(viewDate, direcao));
  };

  const subtitulo = useMemo(() => {
    const n = (lista: Agendamento[]) => `${lista.length} ${plural(lista.length, 'agendamento', 'agendamentos')}`;
    if (emLista) return `${agendamentos.length} de ${total} ${plural(total, 'agendamento', 'agendamentos')}`;
    if (viewMode === 'diario') {
      const iso = toISODate(viewDate);
      return `${rotuloDia(viewDate)} · ${n(agendamentos.filter(a => a.data === iso))}`;
    }
    if (viewMode === 'semanal') {
      const sete = diasDaSemana(viewDate);
      const de = toISODate(sete[0]);
      const ate = toISODate(sete[6]);
      const intervalo = rotuloIntervalo(diasSemana[0], diasSemana[diasSemana.length - 1]);
      return `${intervalo} · ${n(agendamentos.filter(a => a.data >= de && a.data <= ate))}`;
    }
    const prefixo = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    return `${rotuloMes(viewDate)} · ${n(agendamentos.filter(a => a.data.startsWith(prefixo)))}`;
  }, [emLista, agendamentos, total, viewMode, viewDate, diasSemana]);

  const limparTudo = () => { onFiltros(FILTROS_PADRAO); onSearch(''); };
  const periodo = PERIODOS.find(p => p.val === filtros.periodo);

  return (
    <div className="ag-page">
      {/* Cabeçalho: título e resumo · navegação · visão · ação principal */}
      <header className="ag-header">
        <div className="ag-header__titulos">
          <h1 className="ag-titulo">Agenda</h1>
          <div className="ag-subtitulo">{loading ? <Skeleton w={240} h={16} r={4} /> : subtitulo}</div>
        </div>

        <div className="ag-header__acoes">
          {!emLista && (
            <>
              <div className="ag-nav">
                <button type="button" className="ag-btn ag-btn--secundario" onClick={() => onViewDate(new Date())}>Hoje</button>
                <button type="button" className="ag-btn ag-btn--fantasma ag-btn--icone" aria-label={NOME_PERIODO(true, viewMode)} onClick={() => mover(-1)}>
                  {IcSetaEsq}
                </button>
                <button type="button" className="ag-btn ag-btn--fantasma ag-btn--icone" aria-label={NOME_PERIODO(false, viewMode)} onClick={() => mover(1)}>
                  {IcSetaDir}
                </button>
              </div>

              <div className="ag-segmentado" role="group" aria-label="Visão da agenda">
                {VISOES.map(v => (
                  <button key={v.modo} type="button" className="ag-segmentado__item" aria-pressed={viewMode === v.modo} onClick={() => onViewMode(v.modo)}>
                    {v.rotulo}
                  </button>
                ))}
              </div>
            </>
          )}

          <button type="button" className="ag-btn ag-btn--primario" onClick={onNovo}>
            {IcMais}
            Agendar
          </button>
        </div>
      </header>

      {erro && !loading && (
        <div className="ag-aviso os-status--recusada" role="alert">
          <span className="ag-aviso__icone">{IcAlerta}</span>
          <p className="ag-aviso__texto">{erro}</p>
        </div>
      )}

      {/* Busca e filtros */}
      <div className="ag-toolbar">
        <div className="ag-filtros-ativos">
          {filtros.periodo !== 'todos' && periodo && (
            <button type="button" className="ag-pilula" onClick={() => onFiltros({ ...filtros, periodo: 'todos' })} aria-label={`Remover filtro de período: ${periodo.label}`}>
              {periodo.label}
              {IcFechar}
            </button>
          )}
          {filtros.status !== 'todos' && (
            <button type="button" className="ag-pilula" onClick={() => onFiltros({ ...filtros, status: 'todos' })} aria-label={`Remover filtro de status: ${APPOINTMENT_STATUS_CONFIG[filtros.status].label}`}>
              {APPOINTMENT_STATUS_CONFIG[filtros.status].label}
              {IcFechar}
            </button>
          )}
          {temFiltros && (
            <button type="button" className="ag-btn ag-btn--fantasma ag-btn--sm" onClick={limparTudo}>Limpar</button>
          )}
        </div>

        <div className="ag-toolbar__ferramentas">
          <label className="ag-busca">
            {IcBuscar}
            <input
              ref={buscaRef}
              name="busca_agendamentos"
              type="search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar por cliente ou placa"
              aria-label="Buscar agendamentos por cliente, placa, veículo ou serviço"
              autoComplete="off"
            />
          </label>

          <button type="button" className="ag-btn ag-btn--secundario" onClick={onOpenFilters} aria-haspopup="dialog">
            {IcFiltros}
            Filtros
            {qtdFiltros > 0 && <span className="ag-btn__contador">{qtdFiltros}</span>}
          </button>
        </div>
      </div>

      {/* Conteúdo: lista (busca/filtros ativos) ou calendário */}
      {emLista ? (
        <AgendamentoLista
          agendamentos={agendamentos}
          total={total}
          loading={loading}
          temFiltros={temFiltros}
          onAbrir={onCardClick}
          onLimparFiltros={limparTudo}
          onNovo={onNovo}
        />
      ) : loading ? (
        <div className="ag-card"><div className="ag-carregando"><Skeleton h={420} r={6} /></div></div>
      ) : viewMode === 'mensal' ? (
        <AgendaMes date={viewDate} agendamentos={agendamentos} onCardClick={onCardClick} onDayClick={onDayClick} />
      ) : (
        <AgendaGrade
          dias={diasDaGrade}
          agendamentos={agendamentos}
          onCardClick={onCardClick}
          onDayClick={onDayClick}
        />
      )}
    </div>
  );
}

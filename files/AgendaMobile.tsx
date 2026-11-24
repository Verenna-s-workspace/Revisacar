import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../../Primitives';
import type { Agendamento, AgendaFiltros, AgendaViewMode } from '../../../../types/agendamento';
import { toISODate } from '../../../../utils/agenda';
import { AgendamentoFiltrosModal, contarFiltros, FILTROS_PADRAO, PERIODOS } from '../AgendamentoFiltrosModal';
import { APPOINTMENT_STATUS_CONFIG } from '../StatusBadge';
import { ordenarParaLista, plural, rotuloMes } from '../agendamentosDesktopUtils';
import { IcAlerta, IcBuscar, IcCalendario, IcCalendarioPlus, IcFechar, IcFiltros } from '../icones';
import { capitalizar } from './agendaMobileUtils';
import { MobileAppointmentCard } from './MobileAppointmentCard';
import { MobileDailyView } from './MobileDailyView';
import { MobileMonthlyView } from './MobileMonthlyView';
import { MobileWeeklyView } from './MobileWeeklyView';
// Paleta dos selos/avisos (os-status--*) e peças compartilhadas com o desktop (.ag-selo, .ag-aviso, .ag-opcao).
import '../../Ordens/Status.css';
import '../agendamentosDesktop.css';
import './agendaMobile.css';

const POR_PAGINA = 20;

const VISOES: { modo: AgendaViewMode; rotulo: string }[] = [
  { modo: 'diario', rotulo: 'Dia' },
  { modo: 'semanal', rotulo: 'Semana' },
  { modo: 'mensal', rotulo: 'Mês' },
];

interface AgendaMobileProps {
  /** Já com busca e filtros aplicados. */
  agendamentos: Agendamento[];
  /** Total sem busca/filtros — separa "nada cadastrado" de "nada encontrado". */
  total: number;
  loading: boolean;
  erro: string | null;
  viewMode: AgendaViewMode;
  onViewModeChange: (m: AgendaViewMode) => void;
  viewDate: Date;
  onViewDateChange: (d: Date) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filtros: AgendaFiltros;
  onFiltrosChange: (f: AgendaFiltros) => void;
  onCardClick: (ag: Agendamento) => void;
  /** Abre o modal de novo agendamento (data ISO opcional). */
  onNew: (isoDate?: string) => void;
  /** Mês/Semana → toque em um dia: abre a visão Dia. */
  onDayClick: (d: Date) => void;
}

/**
 * Agenda no celular. Mesma lógica do desktop (AgendamentosDesktop): com busca ou filtros ativos a tela
 * mostra a lista; sem eles, o calendário nas visões Dia, Semana e Mês. Filtros abrem no `Modal` do sistema,
 * que no celular sobe de baixo como bottom sheet (o mesmo padrão de Estoque e Veículos).
 */
export function AgendaMobile({
  agendamentos, total, loading, erro,
  viewMode, onViewModeChange, viewDate, onViewDateChange,
  search, onSearchChange, filtros, onFiltrosChange,
  onCardClick, onNew, onDayClick,
}: AgendaMobileProps) {
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);

  // A lista volta às primeiras 20 linhas quando busca/filtros mudam o resultado.
  useEffect(() => { setLimite(POR_PAGINA); }, [agendamentos]);

  const qtdFiltros = contarFiltros(filtros);
  const temFiltros = qtdFiltros > 0 || search.trim().length > 0;
  const periodo = PERIODOS.find(p => p.val === filtros.periodo);
  const limparTudo = () => { onFiltrosChange(FILTROS_PADRAO); onSearchChange(''); };

  const ordenados = useMemo(() => (temFiltros ? ordenarParaLista(agendamentos) : []), [temFiltros, agendamentos]);
  const visiveis = ordenados.slice(0, limite);
  const restantes = ordenados.length - visiveis.length;

  // Ação do cabeçalho: usa o dia que a pessoa está olhando, desde que não seja passado.
  const novoAgendamento = () => {
    const iso = toISODate(viewDate);
    onNew(viewMode !== 'mensal' && iso >= toISODate(new Date()) ? iso : undefined);
  };

  const subtitulo = temFiltros
    ? `${agendamentos.length} de ${total} ${plural(total, 'agendamento', 'agendamentos')}`
    : capitalizar(rotuloMes(viewDate));

  return (
    <div className="agm">
      <header className="agm-topo">
        <div className="agm-barra">
          <div className="agm-barra__titulos">
            <h1 className="agm-titulo">Agenda</h1>
            <div className="agm-subtitulo">{loading ? <Skeleton w={120} h={12} r={4} /> : subtitulo}</div>
          </div>
          <button type="button" className="agm-acao" aria-label="Novo agendamento" onClick={novoAgendamento}>
            {IcCalendarioPlus}
          </button>
        </div>

        <div className="agm-busca-linha">
          <label className="agm-busca">
            {IcBuscar}
            <input
              name="busca_agendamentos"
              type="search"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar cliente ou placa"
              aria-label="Buscar agendamentos por cliente, placa, veículo ou serviço"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <button type="button" className="agm-filtros-btn" aria-haspopup="dialog" onClick={() => setFiltrosAbertos(true)}>
            {IcFiltros}
            Filtros
            {qtdFiltros > 0 && <span className="agm-filtros-btn__contador">{qtdFiltros}</span>}
          </button>
        </div>

        {temFiltros && (
          <div className="agm-ativos" role="group" aria-label="Filtros ativos">
            {filtros.periodo !== 'todos' && periodo && (
              <button type="button" className="agm-pilula" onClick={() => onFiltrosChange({ ...filtros, periodo: 'todos' })} aria-label={`Remover filtro de período: ${periodo.label}`}>
                <span className="agm-pilula__visual">{periodo.label}{IcFechar}</span>
              </button>
            )}
            {filtros.status !== 'todos' && (
              <button type="button" className="agm-pilula" onClick={() => onFiltrosChange({ ...filtros, status: 'todos' })} aria-label={`Remover filtro de status: ${APPOINTMENT_STATUS_CONFIG[filtros.status].label}`}>
                <span className="agm-pilula__visual">{APPOINTMENT_STATUS_CONFIG[filtros.status].label}{IcFechar}</span>
              </button>
            )}
            <button type="button" className="agm-pilula agm-pilula--limpar" onClick={limparTudo}>
              <span className="agm-pilula__visual">Limpar</span>
            </button>
          </div>
        )}

        {!temFiltros && (
          <div className="agm-segmentado" role="group" aria-label="Visão da agenda">
            {VISOES.map(v => (
              <button key={v.modo} type="button" className="agm-segmentado__item" aria-pressed={viewMode === v.modo} onClick={() => onViewModeChange(v.modo)}>
                <span className="agm-segmentado__rotulo">{v.rotulo}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {erro && !loading && (
        <div className="agm-aviso-wrap">
          <div className="ag-aviso os-status--recusada" role="alert">
            <span className="ag-aviso__icone">{IcAlerta}</span>
            <p className="ag-aviso__texto">{erro}</p>
          </div>
        </div>
      )}

      <main className="agm-corpo" aria-busy={loading}>
        {loading ? (
          <div className="agm-carregando" aria-label="Carregando agendamentos">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={88} r={6} />)}
          </div>
        ) : temFiltros ? (
          visiveis.length === 0 ? (
            <div className="agm-vazio">
              <span className="agm-vazio__icone">{IcCalendario}</span>
              <strong>{total > 0 ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento ainda'}</strong>
              <span>{total > 0 ? 'Ajuste a busca ou os filtros aplicados.' : 'Comece agendando o primeiro serviço da sua oficina.'}</span>
              <button type="button" className="agm-btn agm-btn--secundario" onClick={limparTudo}>Limpar filtros</button>
            </div>
          ) : (
            <section aria-label="Lista de agendamentos">
              <ul className="agm-lista">
                {visiveis.map(ag => (
                  <li key={ag.id}><MobileAppointmentCard agendamento={ag} mostrarData onClick={() => onCardClick(ag)} /></li>
                ))}
              </ul>
              {restantes > 0 && (
                <div className="agm-livre">
                  <button type="button" className="agm-btn agm-btn--secundario agm-btn--bloco" onClick={() => setLimite(l => l + POR_PAGINA)}>
                    Mostrar mais {Math.min(restantes, POR_PAGINA)}
                  </button>
                </div>
              )}
            </section>
          )
        ) : (
          <div key={viewMode} className="agm-troca">
            {viewMode === 'diario' && (
              <MobileDailyView date={viewDate} agendamentos={agendamentos} onDateChange={onViewDateChange} onCardClick={onCardClick} onNew={onNew} />
            )}
            {viewMode === 'semanal' && (
              <MobileWeeklyView date={viewDate} agendamentos={agendamentos} onDateChange={onViewDateChange} onCardClick={onCardClick} onDayClick={onDayClick} onNew={onNew} />
            )}
            {viewMode === 'mensal' && (
              <MobileMonthlyView date={viewDate} agendamentos={agendamentos} onDateChange={onViewDateChange} onDayClick={onDayClick} />
            )}
          </div>
        )}
      </main>

      {filtrosAbertos && (
        <AgendamentoFiltrosModal filtros={filtros} onApply={onFiltrosChange} onClose={() => setFiltrosAbertos(false)} />
      )}
    </div>
  );
}

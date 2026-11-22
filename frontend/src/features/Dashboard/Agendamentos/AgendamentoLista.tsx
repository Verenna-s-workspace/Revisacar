import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../Primitives';
import { Placa } from '../Placa';
import type { Agendamento } from '../../../types/agendamento';
import { APPOINTMENT_STATUS_CONFIG } from './StatusBadge';
import { CLASSE_STATUS, dataCurta, ordenarParaLista } from './agendamentosDesktopUtils';
import { IcCalendario, IcCarro, IcMais, IcRelogio, IcSetaDir, IcSetaEsq, IcUsuario } from './icones';

const ITENS_POR_PAGINA = 10;

interface AgendamentoLinhaProps {
  ag: Agendamento;
  onAbrir: (ag: Agendamento) => void;
}

/**
 * Uma linha da lista: moldura com ícone de carro · placa · serviço/cliente · data, horário e
 * mecânico · status. Tudo em Flexbox, sem cabeçalho nem divisão em colunas de tabela.
 */
function AgendamentoLinha({ ag, onAbrir }: AgendamentoLinhaProps) {
  const status = APPOINTMENT_STATUS_CONFIG[ag.status].label;
  const titulo = ag.titulo || 'Agendamento';
  const sub = [ag.cliente, ag.veiculo].filter(Boolean).join(' · ');

  return (
    <li>
      <div
        className="ag-linha"
        role="button"
        tabIndex={0}
        aria-label={`Abrir agendamento: ${titulo}, ${ag.cliente}, placa ${ag.placa}, ${dataCurta(ag.data)} às ${ag.horaInicio}, ${status}`}
        onClick={() => onAbrir(ag)}
        onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(ag); }
        }}
      >
        <span className="ag-foto" aria-hidden="true">{IcCarro}</span>

        <div className="ag-linha__placa"><Placa placa={ag.placa} /></div>

        <div className="ag-linha__principal">
          <span className="ag-linha__titulo" title={titulo}>{titulo}</span>
          {sub && <span className="ag-linha__sub" title={sub}>{sub}</span>}
        </div>

        <div className="ag-linha__meta">
          <span className="ag-meta ag-meta--data">{IcCalendario}{dataCurta(ag.data)}</span>
          <span className="ag-meta ag-meta--hora">{IcRelogio}{ag.horaInicio} – {ag.horaFim}</span>
          <span className="ag-meta ag-meta--mecanico" title={ag.mecanico ?? 'Sem mecânico definido'}>
            {IcUsuario}
            <span className={`ag-meta__texto${ag.mecanico ? '' : ' ag-meta__vazio'}`}>{ag.mecanico || 'Sem mecânico'}</span>
          </span>
        </div>

        <div className="ag-linha__status">
          <span className={`ag-selo ${CLASSE_STATUS[ag.status]}`}>
            <span className="ag-selo__ponto" aria-hidden="true" />
            <span>{status}</span>
          </span>
        </div>
      </div>
    </li>
  );
}

interface AgendamentoListaProps {
  agendamentos: Agendamento[];
  /** Total sem busca/filtros — diferencia "nada cadastrado" de "nada encontrado". */
  total: number;
  loading: boolean;
  temFiltros: boolean;
  onAbrir: (ag: Agendamento) => void;
  onLimparFiltros: () => void;
  onNovo: () => void;
}

export function AgendamentoLista({ agendamentos, total, loading, temFiltros, onAbrir, onLimparFiltros, onNovo }: AgendamentoListaProps) {
  const [pagina, setPagina] = useState(1);
  const ordenados = useMemo(() => ordenarParaLista(agendamentos), [agendamentos]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const visiveis = ordenados.slice(inicio, inicio + ITENS_POR_PAGINA);

  useEffect(() => { setPagina(1); }, [agendamentos]);

  return (
    <section className="ag-card" aria-label="Lista de agendamentos" aria-busy={loading}>
      {loading && (
        <div className="ag-carregando" aria-label="Carregando agendamentos">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={48} r={6} />)}
        </div>
      )}

      {!loading && visiveis.length > 0 && (
        <ul className="ag-lista">
          {visiveis.map(ag => <AgendamentoLinha key={ag.id} ag={ag} onAbrir={onAbrir} />)}
        </ul>
      )}

      {!loading && visiveis.length === 0 && (
        <div className="ag-vazio-estado">
          <span className="ag-vazio-estado__icone">{IcCalendario}</span>
          <strong>{total > 0 ? 'Nenhum agendamento encontrado' : 'Nenhum agendamento ainda'}</strong>
          <span>
            {total > 0
              ? 'Ajuste a busca ou os filtros aplicados para encontrar o agendamento desejado.'
              : 'Comece agendando o primeiro serviço da sua oficina.'}
          </span>
          <div className="ag-vazio-estado__acao">
            {temFiltros ? (
              <button type="button" className="ag-btn ag-btn--secundario ag-btn--sm" onClick={onLimparFiltros}>Limpar filtros</button>
            ) : (
              <button type="button" className="ag-btn ag-btn--primario ag-btn--sm" onClick={onNovo}>{IcMais}Agendar</button>
            )}
          </div>
        </div>
      )}

      {!loading && ordenados.length > 0 && (
        <footer className="ag-paginacao">
          <span className="ag-paginacao__resumo">Mostrando {inicio + 1}–{inicio + visiveis.length} de {ordenados.length}</span>
          <button type="button" className="ag-btn ag-btn--secundario ag-btn--sm" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>
            {IcSetaEsq}Anterior
          </button>
          <button type="button" className="ag-btn ag-btn--secundario ag-btn--sm" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina(paginaAtual + 1)}>
            Próxima{IcSetaDir}
          </button>
        </footer>
      )}
    </section>
  );
}

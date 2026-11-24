import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Skeleton } from '../Primitives';
import { Placa } from '../Placa';
import { formatPhoneBR } from '../../../components/inputs/masks';
import { Valor } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { CLIENTE_STATUS_CONFIG } from './StatusBadge';
import { filtrosAtivos, formatDataCurta } from '../../../utils/clientes_utils';
import { ownerInitial } from '../../../utils/veiculos_utils';
import type { ClienteStats } from '../../../utils/clientes_utils';
import type { ClienteComDados, ClienteFiltros, ClienteStatus, ClienteStatusFiltro } from '../../../types/cliente';
import {
  IcBuscar,
  IcCalendario,
  IcEditar,
  IcFechar,
  IcFiltros,
  IcLixeira,
  IcMais,
  IcOlho,
  IcReticencias,
} from './icones';
import '../Ordens/Status.css';
import './ClientesMobile.css';

const POR_PAGINA = 20;
const LARGURA_ACOES = 144;

const CLASSE_STATUS: Record<ClienteStatus, string> = {
  disponivel: '',
  em_atendimento: 'os-status--em_execucao',
  aguardando_aprovacao: 'os-status--pendente_aprovacao',
  pagamento_pendente: 'os-status--recusada',
  pronto_retirada: 'os-status--finalizada',
  agendado: 'os-status--aprovada',
};

interface Gesto {
  id: string;
  x0: number;
  y0: number;
  base: number;
  horizontal: boolean | null;
  moveu: boolean;
}

interface ClientesMobileProps {
  clientes: ClienteComDados[];
  totalClientes: number;
  stats: ClienteStats;
  loading: boolean;
  erro: string | null;
  search: string;
  filtros: ClienteFiltros;
  onSearch: (v: string) => void;
  onFiltros: (f: ClienteFiltros) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onRecarregar: () => void;
  onNovoCliente: () => void;
  onView: (c: ClienteComDados) => void;
  onEdit: (c: ClienteComDados) => void;
  onSchedule: (c: ClienteComDados) => void;
  onDelete: (c: ClienteComDados) => void;
}

function contarFiltrosAvancados(f: ClienteFiltros): number {
  let n = 0;
  if (f.status !== 'todos') n++;
  if (f.semVeiculos) n++;
  return n;
}

function formatarTelefone(tel?: string): string | null {
  const bruto = (tel ?? '').trim();
  if (!bruto) return null;
  return formatPhoneBR(bruto) || bruto;
}

export function ClientesMobile({
  clientes,
  totalClientes,
  stats,
  loading,
  erro,
  search,
  filtros,
  onSearch,
  onFiltros,
  onOpenFilters,
  onClearFilters,
  onRecarregar,
  onNovoCliente,
  onView,
  onEdit,
  onSchedule,
  onDelete,
}: ClientesMobileProps) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberto, setAberto] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<{ id: string; x: number } | null>(null);
  const [acaoItem, setAcaoItem] = useState<ClienteComDados | null>(null);

  const gesto = useRef<Gesto | null>(null);
  const suprimirClique = useRef(false);

  const hasActiveFilters = filtrosAtivos(filtros) || search.trim().length > 0;
  const qtdFiltros = contarFiltrosAvancados(filtros);

  useEffect(() => {
    setLimite(POR_PAGINA);
    setAberto(null);
  }, [filtros, search]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('.clm-item--aberta')) setAberto(null);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  useEffect(() => {
    if (!acaoItem) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcaoItem(null);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [acaoItem]);

  const visiveis = clientes.slice(0, limite);
  const restantes = clientes.length - visiveis.length;

  // ── Deslizar para revelar Editar / Excluir (mesmo padrão de OrdensMobile) ─
  const aoPressionar = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesto.current = {
      id,
      x0: e.clientX,
      y0: e.clientY,
      base: aberto === id ? -LARGURA_ACOES : 0,
      horizontal: null,
      moveu: false,
    };
  };

  const aoMover = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (g.horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
      if (g.horizontal) e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!g.horizontal) return;
    g.moveu = true;
    const x = Math.max(-LARGURA_ACOES - 24, Math.min(0, g.base + dx));
    setArrasto({ id: g.id, x });
  };

  const aoSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (g?.horizontal && g.moveu) {
      const x = arrasto?.id === g.id ? arrasto.x : g.base;
      setAberto(x < -LARGURA_ACOES / 2 ? g.id : null);
      suprimirClique.current = true;
      window.setTimeout(() => { suprimirClique.current = false; }, 60);
    }
    setArrasto(null);
  };

  const aoTocar = (c: ClienteComDados) => {
    if (suprimirClique.current) return;
    if (aberto) { setAberto(null); return; }
    onView(c);
  };

  const chips: { id: ClienteStatusFiltro; rotulo: string; qtd: number }[] = [
    { id: 'todos', rotulo: 'Todos', qtd: stats.total },
    { id: 'em_atendimento', rotulo: 'Em atendimento', qtd: stats.emAtendimento },
    { id: 'aguardando_aprovacao', rotulo: 'Aguardando', qtd: stats.aguardandoAprovacao },
    { id: 'pagamento_pendente', rotulo: 'Pagamento', qtd: stats.pagamentoPendente },
    { id: 'pronto_retirada', rotulo: 'Prontos', qtd: stats.prontoRetirada },
  ];

  const statusForaDosChips = filtros.status === 'agendado' || filtros.status === 'disponivel';
  const subtitulo = `${totalClientes} ${totalClientes === 1 ? 'cliente' : 'clientes'} · ${stats.emAtendimento} em atendimento`;

  return (
    <div className="clm-page">
      {/* Topo */}
      <header className="clm-topo">
        <div className="clm-barra">
          <div className="clm-barra__titulos">
            <h1 className="clm-titulo">Clientes</h1>
            <p className="clm-subtitulo">{loading ? 'Carregando clientes…' : subtitulo}</p>
          </div>

          <button
            type="button"
            className="clm-acao"
            onClick={onNovoCliente}
            aria-label="Cadastrar cliente"
          >
            {IcMais}
          </button>
        </div>

        <div className="clm-busca-linha">
          <label className="clm-busca">
            {IcBuscar}
            <input
              name="busca_clientes_mobile"
              type="search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar nome, CPF, tel. ou placa"
              aria-label="Buscar clientes por nome, CPF, telefone, e-mail ou placa"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>

          <button
            type="button"
            className="clm-filtros-btn"
            aria-haspopup="dialog"
            onClick={onOpenFilters}
          >
            {IcFiltros}
            Filtros
            {qtdFiltros > 0 && <span className="clm-filtros-btn__contador">{qtdFiltros}</span>}
          </button>
        </div>

        <div className="clm-filtros" role="group" aria-label="Filtrar clientes por situação">
          {chips.map(c => (
            <button
              key={c.id}
              type="button"
              className="clm-chip"
              aria-pressed={filtros.status === c.id}
              onClick={() => onFiltros({ ...filtros, status: c.id })}
            >
              {c.rotulo}
              <span className="clm-chip__qtd">{c.qtd}</span>
            </button>
          ))}

          {statusForaDosChips && (
            <button
              type="button"
              className="clm-pilula"
              onClick={() => onFiltros({ ...filtros, status: 'todos' })}
            >
              {CLIENTE_STATUS_CONFIG[filtros.status as 'agendado' | 'disponivel'].label}
              {IcFechar}
            </button>
          )}

          {filtros.semVeiculos && (
            <button
              type="button"
              className="clm-pilula"
              onClick={() => onFiltros({ ...filtros, semVeiculos: false })}
            >
              Sem veículos
              {IcFechar}
            </button>
          )}
        </div>
      </header>

      {erro && !loading && (
        <div className="clm-aviso os-status--recusada" role="alert">
          <span>{erro}</span>
          <button type="button" className="clm-aviso__btn" onClick={onRecarregar}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Lista */}
      <section className="clm-lista" aria-label="Lista de clientes" aria-busy={loading}>
        {loading ? (
          <div className="clm-carregando">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={72} r={6} />)}
          </div>
        ) : visiveis.length === 0 ? (
          <div className="clm-vazio">
            <strong>{totalClientes > 0 ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</strong>
            <span>
              {totalClientes > 0
                ? 'Ajuste a busca ou os filtros aplicados.'
                : 'Comece cadastrando o primeiro cliente da oficina.'}
            </span>
            {hasActiveFilters ? (
              <button type="button" className="clm-vazio__btn" onClick={onClearFilters}>
                Limpar filtros
              </button>
            ) : (
              <button type="button" className="clm-vazio__btn clm-vazio__btn--primario" onClick={onNovoCliente}>
                Cadastrar cliente
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="clm-itens">
              {visiveis.map(c => {
                const telefone = formatarTelefone(c.telefone);
                const extras = Math.max(0, c.veiculos.length - 1);
                const qtdOS = c.totalOS ?? c.ordens.length;
                const osLabel = `${qtdOS} OS`;
                const visitaLabel = c.ultimaVisita ? formatDataCurta(c.ultimaVisita) : null;
                const metaTopo = [osLabel, visitaLabel].filter(Boolean).join(' · ');
                const statusLabel = CLIENTE_STATUS_CONFIG[c.status].label;

                const mostraAcoes = aberto === c.id || arrasto?.id === c.id;
                const x = arrasto?.id === c.id ? arrasto.x : aberto === c.id ? -LARGURA_ACOES : 0;

                return (
                  <li key={c.id} className={`clm-item${aberto === c.id ? ' clm-item--aberta' : ''}`}>
                    {mostraAcoes && (
                      <div className="clm-acoes" style={{ width: LARGURA_ACOES }}>
                        <button
                          type="button"
                          className="clm-acoes__btn"
                          onClick={() => { setAberto(null); onEdit(c); }}
                        >
                          {IcEditar}
                          Editar
                        </button>
                        <button
                          type="button"
                          className="clm-acoes__btn clm-acoes__btn--perigo"
                          onClick={() => { setAberto(null); onDelete(c); }}
                        >
                          {IcLixeira}
                          Excluir
                        </button>
                      </div>
                    )}

                    <div
                      className="clm-cartao"
                      role="button"
                      tabIndex={0}
                      aria-label={`Visualizar cliente ${c.nome}`}
                      style={{ transform: `translateX(${x}px)`, transition: arrasto?.id === c.id ? 'none' : undefined }}
                      onPointerDown={e => aoPressionar(e, c.id)}
                      onPointerMove={aoMover}
                      onPointerUp={aoSoltar}
                      onPointerCancel={aoSoltar}
                      onClick={() => aoTocar(c)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          aoTocar(c);
                        }
                      }}
                    >
                      <div className="clm-linha1">
                        <span className={`os-status ${CLASSE_STATUS[c.status]}`.trim()}>
                          <span className="os-status__dot" aria-hidden="true" />
                          {statusLabel}
                        </span>
                        <span className="clm-meta-topo">{metaTopo}</span>
                        <span className="clm-gasto" aria-label="Gasto total">{c.gastoTotal !== undefined && c.gastoTotal > 0 ? <Valor texto={formatBRL(c.gastoTotal)} /> : '—'}</span>
                        <button
                          type="button"
                          className="clm-mais-btn"
                          aria-label={`Mais ações de ${c.nome}`}
                          aria-haspopup="dialog"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setAberto(null); setAcaoItem(c); }}
                        >
                          {IcReticencias}
                        </button>
                      </div>

                      <div className="clm-linha2">
                        <span className="clm-avatar" aria-hidden="true">
                          {ownerInitial(c.nome)}
                        </span>
                        <div className="clm-info">
                          <span className="clm-info__nome">{c.nome}</span>
                          <span className="clm-info__detalhe">{telefone ?? '—'}</span>
                        </div>
                        <div className="clm-veiculo-wrap">
                          {c.veiculoPrincipal ? (
                            <>
                              <Placa placa={c.veiculoPrincipal.placa} />
                              {extras > 0 && (
                                <span className="clm-veiculo-extra">+{extras}</span>
                              )}
                            </>
                          ) : (
                            <span className="clm-vazio-cel">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {restantes > 0 && (
              <button type="button" className="clm-mais-pag" onClick={() => setLimite(l => l + POR_PAGINA)}>
                Mostrar mais {Math.min(restantes, POR_PAGINA)}
              </button>
            )}
          </>
        )}
      </section>

      {/* Bottom Sheet: ações completas do cliente */}
      {acaoItem &&
        createPortal(
          <div className="clm-sheet-backdrop" onClick={() => setAcaoItem(null)}>
            <div
              className="clm-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Ações para ${acaoItem.nome}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="clm-sheet__grab" aria-hidden="true" />
              <h2 className="clm-sheet__titulo">{acaoItem.nome}</h2>
              <p className="clm-sheet__sub">
                {formatarTelefone(acaoItem.telefone) ?? 'Sem telefone'}
                {acaoItem.veiculoPrincipal ? ` · ${acaoItem.veiculoPrincipal.placa}` : ''}
              </p>

              <button
                type="button"
                className="clm-sheet__opt"
                onClick={() => { const c = acaoItem; setAcaoItem(null); onView(c); }}
              >
                {IcOlho}
                Visualizar detalhes
              </button>

              <button
                type="button"
                className="clm-sheet__opt"
                onClick={() => { const c = acaoItem; setAcaoItem(null); onEdit(c); }}
              >
                {IcEditar}
                Editar cliente
              </button>

              <button
                type="button"
                className="clm-sheet__opt"
                onClick={() => { const c = acaoItem; setAcaoItem(null); onSchedule(c); }}
              >
                {IcCalendario}
                Agendar
              </button>

              <button
                type="button"
                className="clm-sheet__opt clm-sheet__opt--perigo"
                onClick={() => { const c = acaoItem; setAcaoItem(null); onDelete(c); }}
              >
                {IcLixeira}
                Excluir cliente
              </button>

              <button type="button" className="clm-sheet__cancel" onClick={() => setAcaoItem(null)}>
                Cancelar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
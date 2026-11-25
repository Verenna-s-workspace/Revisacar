import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Skeleton } from '../Primitives';
import { Placa } from '../Placa';
import { formatPhoneBR } from '../../../components/inputs/masks';
import { CLIENTE_STATUS_CONFIG } from './StatusBadge';
import { filtrosAtivos, formatDataCurta } from '../../../utils/clientes_utils';
import { ownerInitial } from '../../../utils/veiculos_utils';
import type { ClienteStats } from '../../../utils/clientes_utils';
import type { ClienteComDados, ClienteFiltros, ClienteStatusFiltro } from '../../../types/cliente';
import {
  IcAlerta,
  IcBuscar,
  IcCalendario,
  IcEditar,
  IcFechar,
  IcFiltros,
  IcLixeira,
  IcMais,
  IcOlho,
  IcReticencias,
  IcSetaDir,
  IcSetaEsq,
  IcUsuario,
} from './icones';
import '../Ordens/Status.css';
import './clientesDesktop.css';

const ITENS_POR_PAGINA = 12;

interface MenuAberto {
  id: string;
  top: number;
  right: number;
}

interface ClientesDesktopProps {
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

export function ClientesDesktop({
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
}: ClientesDesktopProps) {
  const [pagina, setPagina] = useState(1);
  const [menu, setMenu] = useState<MenuAberto | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = filtrosAtivos(filtros) || search.trim().length > 0;
  const qtdFiltros = contarFiltrosAvancados(filtros);

  const totalPaginas = Math.max(1, Math.ceil(clientes.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const visiveis = clientes.slice(inicio, inicio + ITENS_POR_PAGINA);

  useEffect(() => {
    setPagina(1);
  }, [clientes.length, search, filtros]);

  // Menu flutuante da linha: fecha ao clicar fora, pressionar Esc, rolar ou redimensionar.
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!menuRef.current?.contains(alvo) && !(alvo as HTMLElement).closest?.('[data-cl-menu-gatilho]')) {
        setMenu(null);
      }
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    const fechar = () => setMenu(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', fechar, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
    };
  }, [menu]);

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

  const abrirMenu = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    const top = Math.min(r.bottom + 4, Math.max(16, window.innerHeight - 210));
    setMenu({ id, top, right: window.innerWidth - r.right });
  };

  const clienteDoMenu = menu ? clientes.find(c => c.id === menu.id) : undefined;

  const chips: { id: ClienteStatusFiltro; rotulo: string; qtd: number }[] = [
    { id: 'todos', rotulo: 'Todos', qtd: stats.total },
    { id: 'em_atendimento', rotulo: 'Em atendimento', qtd: stats.emAtendimento },
    { id: 'aguardando_aprovacao', rotulo: 'Aguardando aprovação', qtd: stats.aguardandoAprovacao },
    { id: 'pagamento_pendente', rotulo: 'Pagamento pendente', qtd: stats.pagamentoPendente },
    { id: 'pronto_retirada', rotulo: 'Prontos p/ retirada', qtd: stats.prontoRetirada },
  ];

  const statusForaDosChips = filtros.status === 'agendado' || filtros.status === 'disponivel';

  const selecionarChipStatus = (status: ClienteStatusFiltro) => {
    setMenu(null);
    onFiltros({ ...filtros, status });
  };

  const subtitulo = `${totalClientes} ${totalClientes === 1 ? 'cliente' : 'clientes'} · ${stats.emAtendimento} em atendimento`;

  return (
    <div className="cl-page">
      {/* Cabeçalho */}
      <header className="cl-header">
        <div className="cl-header__titulos">
          <h1 className="cl-titulo">Clientes</h1>
          <div className="cl-subtitulo">
            {loading ? <Skeleton w={210} h={16} r={4} /> : subtitulo}
          </div>
        </div>
        <button type="button" className="cl-btn cl-btn--primario" onClick={onNovoCliente}>
          {IcMais}
          Cadastrar cliente
        </button>
      </header>

      {/* Erro de carregamento */}
      {erro && !loading && (
        <div className="cl-aviso os-status--recusada" role="alert">
          <span className="cl-aviso__icone">{IcAlerta}</span>
          <p className="cl-aviso__texto">{erro}</p>
          <button type="button" className="cl-btn cl-btn--primario cl-btn--sm" onClick={onRecarregar}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div className="cl-toolbar">
        <div className="cl-chips" role="group" aria-label="Filtrar clientes por situação">
          {chips.map(c => (
            <button
              key={c.id}
              type="button"
              className="cl-chip"
              aria-pressed={filtros.status === c.id}
              onClick={() => selecionarChipStatus(c.id)}
            >
              {c.rotulo}
              <span className="cl-chip__qtd">{c.qtd}</span>
            </button>
          ))}

          {statusForaDosChips && (
            <button
              type="button"
              className="cl-pilula"
              onClick={() => onFiltros({ ...filtros, status: 'todos' })}
              aria-label={`Remover filtro de status ${CLIENTE_STATUS_CONFIG[filtros.status as 'agendado' | 'disponivel'].label}`}
            >
              {CLIENTE_STATUS_CONFIG[filtros.status as 'agendado' | 'disponivel'].label}
              {IcFechar}
            </button>
          )}

          {filtros.semVeiculos && (
            <button
              type="button"
              className="cl-pilula"
              onClick={() => onFiltros({ ...filtros, semVeiculos: false })}
              aria-label="Remover filtro de clientes sem veículos"
            >
              Sem veículos
              {IcFechar}
            </button>
          )}
        </div>

        <div className="cl-toolbar__ferramentas">
          <label className="cl-busca">
            {IcBuscar}
            <input
              ref={buscaRef}
              name="busca_clientes"
              type="search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar por nome, CPF, telefone ou placa"
              aria-label="Buscar clientes por nome, CPF, telefone, e-mail ou placa"
              autoComplete="off"
            />
          </label>

          <button
            type="button"
            className="cl-btn cl-btn--secundario"
            onClick={onOpenFilters}
            aria-haspopup="dialog"
          >
            {IcFiltros}
            Filtros
            {qtdFiltros > 0 && <span className="cl-btn__contador">{qtdFiltros}</span>}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <section className="cl-card" aria-label="Lista de clientes">
        <div className="cl-card__rolagem">
          <div role="table" className="cl-tabela" aria-label="Clientes cadastrados" aria-busy={loading}>
            <div role="rowgroup">
              <div role="row" className="cl-thead">
                <div role="columnheader">Cliente</div>
                <div role="columnheader">Telefone</div>
                <div role="columnheader">Veículo</div>
                <div role="columnheader">Última visita</div>
                <div role="columnheader" className="cl-num">OS</div>
                <div role="columnheader" className="cl-num">Gasto total</div>
                <div role="columnheader">
                  <span className="cl-sr">Ações</span>
                </div>
              </div>
            </div>

            {!loading && visiveis.length > 0 && (
              <div role="rowgroup">
                {visiveis.map(c => {
                  const telefone = formatarTelefone(c.telefone);
                  const extras = Math.max(0, c.veiculos.length - 1);

                  return (
                    <div
                      key={c.id}
                      role="row"
                      className={`cl-linha${menu?.id === c.id ? ' cl-linha--menu' : ''}`}
                      tabIndex={0}
                      aria-label={`Visualizar cliente ${c.nome}`}
                      onClick={() => onView(c)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onView(c);
                        }
                      }}
                    >
                      <div role="cell" className="cl-cel cl-cel-cliente">
                        <span className="cl-avatar" aria-hidden="true">
                          {ownerInitial(c.nome)}
                        </span>
                        <div className="cl-cliente-info">
                          <span className="cl-cliente-nome" title={c.nome}>
                            {c.nome}
                          </span>
                        </div>
                      </div>

                      <div role="cell" className="cl-cel cl-cel-texto" title={telefone ?? ''}>
                        {telefone ?? <span className="cl-vazio">—</span>}
                      </div>

                      <div role="cell" className="cl-cel cl-cel-veiculo">
                        {c.veiculoPrincipal ? (
                          <>
                            <Placa placa={c.veiculoPrincipal.placa} />
                            {extras > 0 && (
                              <span
                                className="cl-veiculo-extra"
                                title={`+${extras} ${extras === 1 ? 'veículo' : 'veículos'}`}
                              >
                                +{extras}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="cl-vazio">—</span>
                        )}
                      </div>

                      <div role="cell" className="cl-cel cl-cel-data">
                        {c.ultimaVisita ? formatDataCurta(c.ultimaVisita) : <span className="cl-vazio">—</span>}
                      </div>

                      <div role="cell" className="cl-cel cl-cel-num">
                        {c.ordens.length}
                      </div>

                      <div role="cell" className="cl-cel cl-cel-num">
                        <span className="cl-vazio">—</span>
                      </div>

                      <div role="cell" className="cl-cel cl-cel-acoes">
                        <button
                          type="button"
                          className="cl-mais"
                          data-cl-menu-gatilho
                          aria-label={`Mais ações de ${c.nome}`}
                          aria-haspopup="menu"
                          aria-expanded={menu?.id === c.id}
                          onClick={e => abrirMenu(e, c.id)}
                          onKeyDown={e => e.stopPropagation()}
                        >
                          {IcReticencias}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {loading && (
            <div className="cl-carregando" aria-busy="true" aria-label="Carregando clientes">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} h={40} r={6} />
              ))}
            </div>
          )}

          {!loading && visiveis.length === 0 && (
            <div className="cl-vazio-estado">
              <span className="cl-vazio-estado__icone">{IcUsuario}</span>
              <strong>{totalClientes > 0 ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</strong>
              <span>
                {totalClientes > 0
                  ? 'Ajuste a busca ou os filtros aplicados para encontrar o cliente desejado.'
                  : 'Comece cadastrando o primeiro cliente da carteira da sua oficina.'}
              </span>
              <div className="cl-vazio-estado__acao">
                {hasActiveFilters ? (
                  <button type="button" className="cl-btn cl-btn--secundario cl-btn--sm" onClick={onClearFilters}>
                    Limpar filtros
                  </button>
                ) : (
                  <button type="button" className="cl-btn cl-btn--primario cl-btn--sm" onClick={onNovoCliente}>
                    {IcMais}
                    Cadastrar cliente
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Paginação */}
        {!loading && clientes.length > 0 && (
          <footer className="cl-paginacao">
            <span className="cl-paginacao__resumo">
              Mostrando {inicio + 1}–{inicio + visiveis.length} de {clientes.length}
            </span>
            <button
              type="button"
              className="cl-btn cl-btn--secundario cl-btn--sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              {IcSetaEsq}
              Anterior
            </button>
            <button
              type="button"
              className="cl-btn cl-btn--secundario cl-btn--sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
            >
              Próxima
              {IcSetaDir}
            </button>
          </footer>
        )}
      </section>

      {/* Menu flutuante da linha */}
      {menu && clienteDoMenu && (
        <div
          ref={menuRef}
          className="cl-menu"
          role="menu"
          style={{ top: menu.top, right: menu.right }}
        >
          <button
            type="button"
            role="menuitem"
            className="cl-menu__item"
            onClick={() => {
              setMenu(null);
              onView(clienteDoMenu);
            }}
          >
            {IcOlho}
            Visualizar
          </button>
          <button
            type="button"
            role="menuitem"
            className="cl-menu__item"
            onClick={() => {
              setMenu(null);
              onEdit(clienteDoMenu);
            }}
          >
            {IcEditar}
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="cl-menu__item"
            onClick={() => {
              setMenu(null);
              onSchedule(clienteDoMenu);
            }}
          >
            {IcCalendario}
            Agendar
          </button>
          <div className="cl-menu__sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="cl-menu__item cl-menu__item--perigo"
            onClick={() => {
              setMenu(null);
              onDelete(clienteDoMenu);
            }}
          >
            {IcLixeira}
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
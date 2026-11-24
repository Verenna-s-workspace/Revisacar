import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Skeleton } from '../Primitives';
import { Placa } from '../Placa';
import { VEICULO_STATUS_CONFIG } from './StatusBadge';
import { CATEGORIA_LABEL, filtrosAtivos, formatKm } from '../../../utils/veiculos_utils';
import { formatPlaca } from '../../../components/inputs/masks';
import type { VeiculoStats } from '../../../hooks/useVeiculos';
import type { OrdemRow } from '../../../types/dashboard';
import type { VeiculoCadastrado, VeiculoFiltros, VeiculoStatus } from '../../../types/veiculo';
import { VeiculoFoto } from './VeiculoFoto';
import {
  IcAlerta,
  IcBuscar,
  IcCarro,
  IcDesvincular,
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
import './veiculosDesktop.css';

const ITENS_POR_PAGINA = 12;

/** Mapeia o status operacional do veículo para a paleta de Status.css. */
const CLASSE_STATUS: Record<VeiculoStatus, string> = {
  disponivel: '',
  na_oficina: 'os-status--em_execucao',
  aguardando_aprovacao: 'os-status--pendente_aprovacao',
  pronto_entrega: 'os-status--finalizada',
};

const ROTULO_STATUS: Record<VeiculoStatus, string> = {
  disponivel: 'Disponível',
  na_oficina: 'Em serviço',
  aguardando_aprovacao: 'Aguardando aprovação',
  pronto_entrega: 'Pronto p/ entrega',
};

interface MenuAberto {
  id: string;
  top: number;
  right: number;
}

interface VeiculosDesktopProps {
  veiculos: VeiculoCadastrado[];
  totalVeiculos: number;
  stats: VeiculoStats;
  ordens: OrdemRow[];
  loading: boolean;
  erro: string | null;
  search: string;
  filtros: VeiculoFiltros;
  onSearch: (v: string) => void;
  onFiltros: (f: VeiculoFiltros) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onRecarregar: () => void;
  onNovoVeiculo: () => void;
  onView: (v: VeiculoCadastrado) => void;
  onEdit: (v: VeiculoCadastrado) => void;
  onChangeOwner: (v: VeiculoCadastrado) => void;
  onUnlinkOwner: (v: VeiculoCadastrado) => void;
  onDelete: (v: VeiculoCadastrado) => void;
  onNovaOS: (v: VeiculoCadastrado) => void;
}

function contarFiltrosAvancados(f: VeiculoFiltros): number {
  let n = 0;
  if (f.marca) n++;
  if (f.modelo) n++;
  if (f.categoria !== 'todas') n++;
  if (f.anoDe || f.anoAte) n++;
  if (f.cor) n++;
  if (f.proprietario) n++;
  if (f.status !== 'todos') n++;
  if (f.vinculo !== 'todos') n++;
  return n;
}

function formatarDataOS(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR');
}

export function VeiculosDesktop({
  veiculos,
  totalVeiculos,
  stats,
  ordens,
  loading,
  erro,
  search,
  filtros,
  onSearch,
  onFiltros,
  onOpenFilters,
  onClearFilters,
  onRecarregar,
  onNovoVeiculo,
  onView,
  onEdit,
  onChangeOwner,
  onUnlinkOwner,
  onDelete,
  onNovaOS,
}: VeiculosDesktopProps) {
  const [pagina, setPagina] = useState(1);
  const [menu, setMenu] = useState<MenuAberto | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = filtrosAtivos(filtros) || search.trim().length > 0;
  const qtdFiltros = contarFiltrosAvancados(filtros);

  // Mapa rápido da última OS por id e por placa normalizada.
  const ultimaOSPorVeiculo = useMemo(() => {
    const porId = new Map<string, OrdemRow>();
    const porPlaca = new Map<string, OrdemRow>();

    for (const o of ordens) {
      porId.set(o.id, o);
      const placaNorm = formatPlaca(o.placa);
      if (!placaNorm) continue;
      const atual = porPlaca.get(placaNorm);
      if (!atual || new Date(o.created_at).getTime() > new Date(atual.created_at).getTime()) {
        porPlaca.set(placaNorm, o);
      }
    }

    return (v: VeiculoCadastrado): OrdemRow | undefined => {
      if (v.ultimaOSId && porId.has(v.ultimaOSId)) return porId.get(v.ultimaOSId);
      const placaNorm = formatPlaca(v.placa);
      return placaNorm ? porPlaca.get(placaNorm) : undefined;
    };
  }, [ordens]);

  const totalPaginas = Math.max(1, Math.ceil(veiculos.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const visiveis = veiculos.slice(inicio, inicio + ITENS_POR_PAGINA);

  useEffect(() => {
    setPagina(1);
  }, [veiculos.length, search, filtros]);

  // Menu flutuante da linha: fecha ao clicar fora, pressionar Esc, rolar ou redimensionar.
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!menuRef.current?.contains(alvo) && !(alvo as HTMLElement).closest?.('[data-ve-menu-gatilho]')) {
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

  // Atalho "/" foca a busca (mesmo padrão de Ordens, Estoque e Serviços).
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
    const top = Math.min(r.bottom + 4, Math.max(16, window.innerHeight - 270));
    setMenu({ id, top, right: window.innerWidth - r.right });
  };

  const veiculoDoMenu = menu ? veiculos.find(v => v.id === menu.id) : undefined;

  const chips: { id: VeiculoStatus | 'todos'; rotulo: string; qtd: number }[] = [
    { id: 'todos', rotulo: 'Todos', qtd: stats.total },
    { id: 'na_oficina', rotulo: 'Em serviço', qtd: stats.naOficina },
    { id: 'aguardando_aprovacao', rotulo: 'Aguardando aprovação', qtd: stats.aguardandoAprovacao },
    { id: 'pronto_entrega', rotulo: 'Prontos p/ entrega', qtd: stats.prontoEntrega },
  ];

  const selecionarChipStatus = (status: VeiculoStatus | 'todos') => {
    setMenu(null);
    onFiltros({ ...filtros, status });
  };

  const subtitulo = `${totalVeiculos} ${totalVeiculos === 1 ? 'veículo' : 'veículos'} · ${stats.naOficinaTotal} na oficina`;

  return (
    <div className="ve-page">
      {/* Cabeçalho */}
      <header className="ve-header">
        <div className="ve-header__titulos">
          <h1 className="ve-titulo">Veículos</h1>
          <div className="ve-subtitulo">
            {loading ? <Skeleton w={210} h={16} r={4} /> : subtitulo}
          </div>
        </div>
        <button type="button" className="ve-btn ve-btn--primario" onClick={onNovoVeiculo}>
          {IcMais}
          Cadastrar veículo
        </button>
      </header>

      {/* Erro de carregamento */}
      {erro && !loading && (
        <div className="ve-aviso os-status--recusada" role="alert">
          <span className="ve-aviso__icone">{IcAlerta}</span>
          <p className="ve-aviso__texto">{erro}</p>
          <button type="button" className="ve-btn ve-btn--primario ve-btn--sm" onClick={onRecarregar}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div className="ve-toolbar">
        <div className="ve-chips" role="group" aria-label="Filtrar veículos por situação">
          {chips.map(c => (
            <button
              key={c.id}
              type="button"
              className="ve-chip"
              aria-pressed={filtros.status === c.id}
              onClick={() => selecionarChipStatus(c.id)}
            >
              {c.rotulo}
              <span className="ve-chip__qtd">{c.qtd}</span>
            </button>
          ))}

          {filtros.categoria !== 'todas' && (
            <button
              type="button"
              className="ve-pilula"
              onClick={() => onFiltros({ ...filtros, categoria: 'todas' })}
              aria-label={`Remover filtro da categoria ${CATEGORIA_LABEL[filtros.categoria]}`}
            >
              {CATEGORIA_LABEL[filtros.categoria]}
              {IcFechar}
            </button>
          )}

          {filtros.vinculo !== 'todos' && (
            <button
              type="button"
              className="ve-pilula"
              onClick={() => onFiltros({ ...filtros, vinculo: 'todos' })}
              aria-label="Remover filtro de vínculo com proprietário"
            >
              {filtros.vinculo === 'com' ? 'Com proprietário' : 'Sem proprietário'}
              {IcFechar}
            </button>
          )}

          {filtros.marca && (
            <button
              type="button"
              className="ve-pilula"
              onClick={() => onFiltros({ ...filtros, marca: '' })}
              aria-label={`Remover filtro da marca ${filtros.marca}`}
            >
              {filtros.marca}
              {IcFechar}
            </button>
          )}
        </div>

        <div className="ve-toolbar__ferramentas">
          <label className="ve-busca">
            {IcBuscar}
            <input
              ref={buscaRef}
              name="busca_veiculos"
              type="search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar por placa, modelo ou dono"
              aria-label="Buscar veículos por placa, marca, modelo ou proprietário"
              autoComplete="off"
            />
          </label>

          <button
            type="button"
            className="ve-btn ve-btn--secundario"
            onClick={onOpenFilters}
            aria-haspopup="dialog"
          >
            {IcFiltros}
            Filtros
            {qtdFiltros > 0 && <span className="ve-btn__contador">{qtdFiltros}</span>}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <section className="ve-card" aria-label="Lista de veículos">
        <div className="ve-card__rolagem">
          <div role="table" className="ve-tabela" aria-label="Veículos cadastrados" aria-busy={loading}>
            <div role="rowgroup">
              <div role="row" className="ve-thead">
                <div role="columnheader">Modelo</div>
                <div role="columnheader">Placa</div>
                <div role="columnheader">Dono</div>
                <div role="columnheader" className="ve-num">Km</div>
                <div role="columnheader">Situação</div>
                <div role="columnheader">Última OS</div>
                <div role="columnheader">
                  <span className="ve-sr">Ações</span>
                </div>
              </div>
            </div>

            {!loading && visiveis.length > 0 && (
              <div role="rowgroup">
                {visiveis.map(v => {
                  const titulo = `${[v.marca, v.modelo].filter(Boolean).join(' ')}${v.ano ? ` · ${v.ano}` : ''}`;
                  const subtituloLinha = [CATEGORIA_LABEL[v.categoria], v.cor].filter(Boolean).join(' · ');
                  const ultimaOS = ultimaOSPorVeiculo(v);
                  const dataUltimaOS = formatarDataOS(ultimaOS?.created_at);
                  const statusLabel = ROTULO_STATUS[v.status] ?? VEICULO_STATUS_CONFIG[v.status].label;

                  return (
                    <div
                      key={v.id}
                      role="row"
                      className={`ve-linha${menu?.id === v.id ? ' ve-linha--menu' : ''}`}
                      tabIndex={0}
                      aria-label={`Visualizar ${v.marca} ${v.modelo} (${v.placa})`}
                      onClick={() => onView(v)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onView(v);
                        }
                      }}
                    >
                      <div role="cell" className="ve-cel ve-cel-veiculo">
                        <VeiculoFoto src={v.fotoPrincipal} categoria={v.categoria} />
                        <div className="ve-item">
                          <div className="ve-item__nome" title={titulo}>
                            {titulo}
                          </div>
                          {subtituloLinha && (
                            <div className="ve-item__sub" title={subtituloLinha}>
                              {subtituloLinha}
                            </div>
                          )}
                        </div>
                      </div>

                      <div role="cell" className="ve-cel">
                        <Placa placa={v.placa} />
                      </div>

                      <div role="cell" className="ve-cel ve-cel-texto" title={v.proprietario?.nome ?? ''}>
                        {v.proprietario?.nome || <span className="ve-vazio">Sem proprietário</span>}
                      </div>

                      <div role="cell" className="ve-cel ve-cel-num">
                        {formatKm(v.quilometragem)}
                      </div>

                      <div role="cell" className="ve-cel">
                        <span className={`os-status ${CLASSE_STATUS[v.status]}`.trim()}>
                          <span className="os-status__dot" aria-hidden="true" />
                          {statusLabel}
                        </span>
                      </div>

                      <div
                        role="cell"
                        className="ve-cel ve-cel-data"
                        title={ultimaOS ? `OS #${ultimaOS.os_num}` : undefined}
                      >
                        {dataUltimaOS ?? <span className="ve-vazio">—</span>}
                      </div>

                      <div role="cell" className="ve-cel ve-cel-acoes">
                        <button
                          type="button"
                          className="ve-mais"
                          data-ve-menu-gatilho
                          aria-label={`Mais ações de ${v.marca} ${v.modelo}`}
                          aria-haspopup="menu"
                          aria-expanded={menu?.id === v.id}
                          onClick={e => abrirMenu(e, v.id)}
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
            <div className="ve-carregando" aria-busy="true" aria-label="Carregando veículos">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} h={40} r={6} />
              ))}
            </div>
          )}

          {!loading && visiveis.length === 0 && (
            <div className="ve-vazio-estado">
              <span className="ve-vazio-estado__icone">{IcCarro}</span>
              <strong>{totalVeiculos > 0 ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}</strong>
              <span>
                {totalVeiculos > 0
                  ? 'Ajuste a busca ou os filtros aplicados para encontrar o veículo desejado.'
                  : 'Comece cadastrando o primeiro veículo da frota da sua oficina.'}
              </span>
              <div className="ve-vazio-estado__acao">
                {hasActiveFilters ? (
                  <button type="button" className="ve-btn ve-btn--secundario ve-btn--sm" onClick={onClearFilters}>
                    Limpar filtros
                  </button>
                ) : (
                  <button type="button" className="ve-btn ve-btn--primario ve-btn--sm" onClick={onNovoVeiculo}>
                    {IcMais}
                    Cadastrar veículo
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Paginação */}
        {!loading && veiculos.length > 0 && (
          <footer className="ve-paginacao">
            <span className="ve-paginacao__resumo">
              Mostrando {inicio + 1}–{inicio + visiveis.length} de {veiculos.length}
            </span>
            <button
              type="button"
              className="ve-btn ve-btn--secundario ve-btn--sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              {IcSetaEsq}
              Anterior
            </button>
            <button
              type="button"
              className="ve-btn ve-btn--secundario ve-btn--sm"
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
      {menu && veiculoDoMenu && (
        <div
          ref={menuRef}
          className="ve-menu"
          role="menu"
          style={{ top: menu.top, right: menu.right }}
        >
          <button
            type="button"
            role="menuitem"
            className="ve-menu__item"
            onClick={() => {
              setMenu(null);
              onView(veiculoDoMenu);
            }}
          >
            {IcOlho}
            Visualizar
          </button>
          <button
            type="button"
            role="menuitem"
            className="ve-menu__item"
            onClick={() => {
              setMenu(null);
              onEdit(veiculoDoMenu);
            }}
          >
            {IcEditar}
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="ve-menu__item"
            onClick={() => {
              setMenu(null);
              onNovaOS(veiculoDoMenu);
            }}
          >
            {IcMais}
            Nova OS
          </button>
          <div className="ve-menu__sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="ve-menu__item"
            onClick={() => {
              setMenu(null);
              onChangeOwner(veiculoDoMenu);
            }}
          >
            {IcUsuario}
            {veiculoDoMenu.proprietario ? 'Alterar proprietário' : 'Vincular proprietário'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="ve-menu__item"
            disabled={!veiculoDoMenu.proprietario}
            onClick={() => {
              setMenu(null);
              onUnlinkOwner(veiculoDoMenu);
            }}
          >
            {IcDesvincular}
            Desvincular proprietário
          </button>
          <div className="ve-menu__sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="ve-menu__item ve-menu__item--perigo"
            onClick={() => {
              setMenu(null);
              onDelete(veiculoDoMenu);
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
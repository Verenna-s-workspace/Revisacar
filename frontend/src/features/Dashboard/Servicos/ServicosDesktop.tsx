import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '../Primitives';
import { formatPreco } from '../../../utils/servicos_utils';
import type { ServicoItem } from '../../../types/servico';
import {
  IcBuscar,
  IcCheck,
  IcEditar,
  IcFiltros,
  IcLixeira,
  IcMais,
  IcReticencias,
  IcSetaDir,
  IcSetaEsq,
} from './icones';
import './servicos.css';

type StatusFiltro = 'todos' | 'ativos' | 'inativos';

interface MenuAberto {
  id: string;
  top: number;
  right: number;
}

interface Props {
  servicos: ServicoItem[];
  loading: boolean;
  erro: string | null;
  erroAcao: string | null;
  onLimparErroAcao: () => void;
  kitPorServicoId: Map<string, string>;
  onNovo: () => void;
  onEditar: (servico: ServicoItem) => void;
  onToggleAtivo: (id: string) => void;
  onExcluir: (servico: ServicoItem) => void;
}

const ITENS_POR_PAGINA = 8;

export function ServicosDesktop({
  servicos,
  loading,
  erro,
  erroAcao,
  onLimparErroAcao,
  kitPorServicoId,
  onNovo,
  onEditar,
  onToggleAtivo,
  onExcluir,
}: Props) {
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [categoria, setCategoria] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menu, setMenu] = useState<MenuAberto | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);
  const filtrosRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Contagens e categorias (categorias usadas no popover de Filtros) ──────
  const { ativosCount, inativosCount, categoriasOrdenadas } = useMemo(() => {
    let ativos = 0;
    let inativos = 0;
    const porCat = new Map<string, number>();

    for (const s of servicos) {
      if (s.ativo) ativos++;
      else inativos++;
      porCat.set(s.categoria, (porCat.get(s.categoria) ?? 0) + 1);
    }

    const cats = Array.from(porCat.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR'));

    return { ativosCount: ativos, inativosCount: inativos, categoriasOrdenadas: cats };
  }, [servicos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return servicos.filter(s => {
      if (statusFiltro === 'ativos' && !s.ativo) return false;
      if (statusFiltro === 'inativos' && s.ativo) return false;
      if (categoria !== 'todas' && s.categoria !== categoria) return false;
      if (!q) return true;
      return (
        s.nome.toLowerCase().includes(q) ||
        s.categoria.toLowerCase().includes(q) ||
        (s.descricao ?? '').toLowerCase().includes(q)
      );
    });
  }, [servicos, statusFiltro, categoria, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const visiveis = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  const filtrosAtivosCount = (categoria !== 'todas' ? 1 : 0) + (statusFiltro !== 'todos' ? 1 : 0);

  useEffect(() => {
    setPagina(1);
  }, [statusFiltro, categoria, busca]);

  // ── Popovers: fechar com Esc, clique fora ou rolagem ──────────────────────
  useEffect(() => {
    if (!filtrosAbertos && !menu) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (filtrosAbertos && !filtrosRef.current?.contains(alvo)) setFiltrosAbertos(false);
      if (menu && !menuRef.current?.contains(alvo) && !(alvo as HTMLElement).closest?.('[data-sv-menu-gatilho]')) {
        setMenu(null);
      }
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltrosAbertos(false);
        setMenu(null);
      }
    };
    const fechaMenu = () => setMenu(null);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechaMenu);
    window.addEventListener('scroll', fechaMenu, true);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechaMenu);
      window.removeEventListener('scroll', fechaMenu, true);
    };
  }, [filtrosAbertos, menu]);

  // Atalho "/" foca a busca
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

  const abrirMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (menu?.id === id) {
      setMenu(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ id, top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  const servicoDoMenu = menu ? servicos.find(s => s.id === menu.id) : undefined;
  const subtitulo =
    ativosCount === 1
      ? '1 serviço ativo · usado para montar orçamentos'
      : `${ativosCount} serviços ativos · usados para montar orçamentos`;

  return (
    <div className="sv-page">
      {/* Cabeçalho */}
      <header className="sv-header">
        <div className="sv-header__titulos">
          <h1 className="sv-titulo">Catálogo de serviços</h1>
          <p className="sv-subtitulo">{loading ? 'Carregando serviços…' : subtitulo}</p>
        </div>
        <button type="button" className="sv-btn sv-btn--primario" onClick={onNovo}>
          {IcMais}
          Novo serviço
        </button>
      </header>

      {erro && (
        <div className="sv-aviso" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {erroAcao && (
        <div className="sv-aviso" role="alert">
          <span>{erroAcao}</span>
          <button type="button" className="sv-btn sv-btn--secundario sv-btn--sm" onClick={onLimparErroAcao}>
            Fechar
          </button>
        </div>
      )}

      {/* Barra de filtros */}
      <div className="sv-toolbar">
        <div className="sv-chips" role="group" aria-label="Filtros rápidos">
          <button
            type="button"
            className="sv-chip"
            aria-pressed={statusFiltro === 'ativos'}
            onClick={() => setStatusFiltro(prev => (prev === 'ativos' ? 'todos' : 'ativos'))}
          >
            Ativos
            <span className="sv-chip__qtd">{ativosCount}</span>
          </button>

          <button
            type="button"
            className="sv-chip"
            aria-pressed={statusFiltro === 'inativos'}
            onClick={() => setStatusFiltro(prev => (prev === 'inativos' ? 'todos' : 'inativos'))}
          >
            Inativos
            <span className="sv-chip__qtd">{inativosCount}</span>
          </button>
        </div>

        <div className="sv-toolbar__ferramentas">
          <label className="sv-busca">
            {IcBuscar}
            <input
              ref={buscaRef}
              name="busca_servicos"
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar serviço"
              aria-label="Buscar serviço"
              autoComplete="off"
            />
          </label>

          <div className="sv-filtros" ref={filtrosRef}>
            <button
              type="button"
              className="sv-btn sv-btn--secundario"
              aria-expanded={filtrosAbertos}
              aria-haspopup="dialog"
              onClick={() => setFiltrosAbertos(v => !v)}
            >
              {IcFiltros}
              Filtros
              {filtrosAtivosCount > 0 && <span className="sv-btn__contador">{filtrosAtivosCount}</span>}
            </button>

            {filtrosAbertos && (
              <div className="sv-popover" role="dialog" aria-label="Filtros do catálogo">
                <label className="sv-campo">
                  <span>Situação</span>
                  <select
                    value={statusFiltro}
                    onChange={e => setStatusFiltro(e.target.value as StatusFiltro)}
                  >
                    <option value="todos">Todos</option>
                    <option value="ativos">Somente ativos</option>
                    <option value="inativos">Somente inativos</option>
                  </select>
                </label>

                <label className="sv-campo">
                  <span>Categoria</span>
                  <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                    <option value="todas">Todas as categorias</option>
                    {categoriasOrdenadas.map(c => (
                      <option key={c.nome} value={c.nome}>
                        {c.nome} ({c.qtd})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="sv-popover__rodape">
                  <button
                    type="button"
                    className="sv-btn sv-btn--secundario sv-btn--sm"
                    disabled={filtrosAtivosCount === 0}
                    onClick={() => {
                      setStatusFiltro('todos');
                      setCategoria('todas');
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <section className="sv-card" aria-label="Lista de serviços">
        <div className="sv-card__rolagem">
          <table className="sv-tabela">
            <colgroup>
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 52 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Serviço</th>
                <th scope="col">Categoria</th>
                <th scope="col" className="sv-num">Duração</th>
                <th scope="col" className="sv-num">Preço</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sv-sr">Ações</span>
                </th>
              </tr>
            </thead>

            {!loading && visiveis.length > 0 && (
              <tbody>
                {visiveis.map(s => {
                  const kitNome = kitPorServicoId.get(s.id);
                  return (
                    <tr
                      key={s.id}
                      className={`sv-linha${s.ativo ? '' : ' sv-linha--inativo'}${menu?.id === s.id ? ' sv-linha--menu' : ''}`}
                      tabIndex={0}
                      aria-label={`Editar serviço ${s.nome}`}
                      onClick={() => onEditar(s)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onEditar(s);
                        }
                      }}
                    >
                      <td>
                        <div className="sv-servico-nome">{s.nome}</div>
                        {kitNome && <div className="sv-servico-kit">Kit: {kitNome}</div>}
                      </td>
                      <td className="sv-cel-categoria">{s.categoria}</td>
                      <td className="sv-num sv-cel-num">{s.duracao}</td>
                      <td className="sv-num sv-cel-num">R$ {formatPreco(s.preco)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="sv-situacao">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={s.ativo}
                            aria-label={`${s.nome}: ${s.ativo ? 'Ativo' : 'Inativo'}`}
                            className="sv-switch"
                            onClick={() => onToggleAtivo(s.id)}
                          >
                            <span className="sv-switch__thumb" aria-hidden="true" />
                          </button>
                          <span className="sv-situacao__rotulo">{s.ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                      </td>
                      <td className="sv-cel-acoes" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="sv-mais"
                          data-sv-menu-gatilho
                          aria-label={`Mais ações de ${s.nome}`}
                          aria-haspopup="menu"
                          aria-expanded={menu?.id === s.id}
                          onClick={e => abrirMenu(e, s.id)}
                        >
                          {IcReticencias}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>

          {loading && (
            <div className="sv-carregando" aria-busy="true" aria-label="Carregando serviços">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} h={20} r={4} />
              ))}
            </div>
          )}

          {!loading && visiveis.length === 0 && (
            <div className="sv-vazio-estado">
              <strong>Nenhum serviço encontrado</strong>
              <span>
                {busca || filtrosAtivosCount > 0
                  ? 'Ajuste a busca ou os filtros aplicados.'
                  : 'Cadastre o primeiro serviço do catálogo para começar.'}
              </span>
            </div>
          )}
        </div>

        {/* Paginação */}
        {!loading && filtrados.length > 0 && (
          <footer className="sv-paginacao">
            <span className="sv-paginacao__resumo">
              Mostrando {inicio + 1}–{inicio + visiveis.length} de {filtrados.length}
            </span>
            <button
              type="button"
              className="sv-btn sv-btn--secundario sv-btn--sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              {IcSetaEsq}
              Anterior
            </button>
            <button
              type="button"
              className="sv-btn sv-btn--secundario sv-btn--sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
            >
              Próxima
              {IcSetaDir}
            </button>
          </footer>
        )}
      </section>

      {/* Menu ⋯ da linha */}
      {menu && servicoDoMenu && (
        <div
          ref={menuRef}
          className="sv-menu"
          role="menu"
          style={{ top: menu.top, right: menu.right }}
        >
          <button
            type="button"
            role="menuitem"
            className="sv-menu__item"
            onClick={() => {
              setMenu(null);
              onEditar(servicoDoMenu);
            }}
          >
            {IcEditar}
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="sv-menu__item"
            onClick={() => {
              setMenu(null);
              onToggleAtivo(servicoDoMenu.id);
            }}
          >
            {IcCheck}
            {servicoDoMenu.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <div className="sv-menu__sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="sv-menu__item sv-menu__item--perigo"
            onClick={() => {
              setMenu(null);
              onExcluir(servicoDoMenu);
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
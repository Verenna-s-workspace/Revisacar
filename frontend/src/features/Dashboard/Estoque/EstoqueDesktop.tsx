import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Skeleton } from '../Primitives';
import { Valor } from '../../../components/Privacidade';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatBRL } from '../../../utils/dashboard';
import { filtrarItensPorBusca, itemEstaBaixo, ordenarPorCriticidade } from '../../../utils/estoque_utils';
import type { EstoqueItem, EstoqueKit } from '../../../types/estoque';
import { agruparCategorias } from './categorias';
import { EstoqueLinha } from './EstoqueLinha';
import { KitLinha } from './KitLinha';
import { QuarentenaAviso } from './QuarentenaAviso';
import {
  IcAlerta, IcBuscar, IcCaixa, IcEditar, IcFechar, IcFiltros, IcLixeira, IcMais, IcSetaDir, IcSetaEsq,
} from './icones';
// Paleta dos selos/linhas (recusada, pendente, finalizada) vem do status da OS —
// uma só fonte de cor pro sistema inteiro. Só define variáveis --st-*.
import '../Ordens/Status.css';
import './estoqueDesktop.css';

const ITENS_POR_PAGINA = 8;

type FiltroRapido = 'todos' | 'baixo' | 'kits';

const ROTULO_FILTRO: Record<FiltroRapido, string> = {
  todos: 'Todos',
  baixo: 'Estoque baixo',
  kits: 'Kits',
};
const FILTROS: FiltroRapido[] = ['todos', 'baixo', 'kits'];

interface MenuAberto { tipo: 'item' | 'kit'; id: string; top: number; right: number }

interface EstoqueDesktopProps {
  itens: EstoqueItem[];
  kits: EstoqueKit[];
  carregando: boolean;
  erro: string | null;
  valorTotal: number;
  busca: string;
  onBusca: (texto: string) => void;
  erroExcluir: string | null;
  onFecharErroExcluir: () => void;
  onRecarregar: () => void;
  /** `categoria`: categoria filtrada no momento, pra já vir selecionada no modal. */
  onNovoProduto: (categoria?: string) => void;
  onNovoKit: () => void;
  onEditarProduto: (item: EstoqueItem) => void;
  onExcluirProduto: (item: EstoqueItem) => void;
  onEditarKit: (kit: EstoqueKit) => void;
  onExcluirKit: (kit: EstoqueKit) => void;
  onAplicarKit: (kit: EstoqueKit) => void;
  aplicandoKitId: string | null;
  erroAplicarKit: Record<string, string>;
  disponibilidadeKit: (kit: EstoqueKit) => number;
}

export function EstoqueDesktop({
  itens, kits, carregando, erro, valorTotal, busca, onBusca,
  erroExcluir, onFecharErroExcluir, onRecarregar,
  onNovoProduto, onNovoKit, onEditarProduto, onExcluirProduto, onEditarKit, onExcluirKit,
  onAplicarKit, aplicandoKitId, erroAplicarKit, disponibilidadeKit,
}: EstoqueDesktopProps) {
  const { can } = usePermissions();
  // Custo = base da margem: mesma regra do Orçamento (financeiro.ver_margem).
  const mostrarCusto = can('financeiro.ver_margem');

  const [filtro, setFiltro] = useState<FiltroRapido>('todos');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menu, setMenu] = useState<MenuAberto | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);
  const filtrosRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const emKits = filtro === 'kits';

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const itensPorId = useMemo(() => new Map(itens.map(i => [i.id, i])), [itens]);
  const qtdBaixos = useMemo(() => itens.filter(itemEstaBaixo).length, [itens]);

  const gruposCategoria = useMemo(() => agruparCategorias(itens), [itens]);

  const itensFiltrados = useMemo(() => {
    // "Estoque baixo": mais crítico primeiro. Busca e categoria combinam com qualquer filtro rápido.
    const base = filtro === 'baixo' ? ordenarPorCriticidade(itens.filter(itemEstaBaixo)) : itens;
    const porBusca = busca.trim() ? filtrarItensPorBusca(base, busca) : base;
    return categoria ? porBusca.filter(i => i.categoria === categoria) : porBusca;
  }, [itens, filtro, busca, categoria]);

  const kitsFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return kits;
    return kits.filter(k => k.nome.toLowerCase().includes(q) || (k.descricao ?? '').toLowerCase().includes(q));
  }, [kits, busca]);

  const total = emKits ? kitsFiltrados.length : itensFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const itensVisiveis = itensFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  const kitsVisiveis = kitsFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  const qtdVisiveis = emKits ? kitsVisiveis.length : itensVisiveis.length;

  const contagem: Record<FiltroRapido, number> = { todos: itens.length, baixo: qtdBaixos, kits: kits.length };

  // Mudou o recorte: volta pra primeira página.
  useEffect(() => { setPagina(1); }, [filtro, busca, categoria]);

  // ── Popovers: fechar com Esc / clique fora / rolagem ───────────────────────
  useEffect(() => {
    if (!filtrosAbertos && !menu) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (filtrosAbertos && !filtrosRef.current?.contains(alvo)) setFiltrosAbertos(false);
      if (menu && !menuRef.current?.contains(alvo) && !(alvo as HTMLElement).closest?.('[data-es-menu-gatilho]')) setMenu(null);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFiltrosAbertos(false); setMenu(null); } };
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

  // Atalho "/" foca a busca da lista (fora de campos de texto).
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

  function escolherFiltro(f: FiltroRapido) {
    setFiltro(f);
    setMenu(null);
    if (f === 'kits') setFiltrosAbertos(false); // categoria só vale pra itens
  }

  const abrirMenu = (tipo: MenuAberto['tipo']) => (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (menu?.id === id) { setMenu(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ tipo, id, top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  const itemDoMenu = menu?.tipo === 'item' ? itensPorId.get(menu.id) : undefined;
  const kitDoMenu = menu?.tipo === 'kit' ? kits.find(k => k.id === menu.id) : undefined;

  const subtitulo = (
    <>
      {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {kits.length} {kits.length === 1 ? 'kit' : 'kits'} · valor em estoque{' '}
      <Valor texto={formatBRL(valorTotal)} />
    </>
  );

  const semItensCadastrados = !carregando && itens.length === 0 && !busca.trim();
  const mensagemVazia = emKits
    ? (kits.length === 0
      ? { titulo: 'Nenhum kit cadastrado', texto: 'Combine itens já cadastrados numa receita pra dar baixa rápida em serviços comuns' }
      : { titulo: 'Nenhum kit encontrado', texto: 'Tente buscar por outro nome' })
    : (semItensCadastrados
      ? { titulo: 'Nenhum item cadastrado', texto: 'Cadastre o primeiro item pra começar' }
      : { titulo: 'Nenhum item encontrado', texto: 'Ajuste os filtros ou busque por outro nome ou veículo de aplicação' });

  return (
    <div className="es-page">
      {/* Cabeçalho da página */}
      <header className="es-header">
        <div className="es-header__titulos">
          <h1 className="es-titulo">Estoque</h1>
          <div className="es-subtitulo">{carregando ? <Skeleton w={280} h={16} r={4} /> : subtitulo}</div>
        </div>
        {!erro && (
          <>
            <button type="button" className="es-btn es-btn--secundario" onClick={onNovoKit}>
              {IcCaixa}
              Novo kit
            </button>
            <button type="button" className="es-btn es-btn--primario" onClick={() => onNovoProduto(categoria || undefined)}>
              {IcMais}
              Novo produto
            </button>
          </>
        )}
      </header>

      {/* Falha ao excluir (o modal de confirmação já fechou) */}
      {erroExcluir && (
        <div className="es-aviso os-status--recusada" role="alert">
          <span className="es-aviso__icone">{IcAlerta}</span>
          <p className="es-aviso__texto">{erroExcluir}</p>
          <button type="button" className="es-btn es-btn--secundario es-btn--sm" onClick={onFecharErroExcluir}>Fechar</button>
        </div>
      )}

      {/* Falha ao carregar: estoque errado pode prometer peça que não existe, então nada é mostrado */}
      {erro && !carregando && (
        <div className="es-aviso os-status--recusada" role="alert">
          <span className="es-aviso__icone">{IcAlerta}</span>
          <p className="es-aviso__texto">{erro}</p>
          <button type="button" className="es-btn es-btn--primario es-btn--sm" onClick={onRecarregar}>Tentar novamente</button>
        </div>
      )}

      {!erro && (
        <>
          {!carregando && !busca.trim() && <QuarentenaAviso itens={itens} />}

          {/* Barra de filtros */}
          <div className="es-toolbar">
            <div className="es-chips" role="group" aria-label="Filtrar o estoque">
              {FILTROS.map(f => (
                <button
                  key={f}
                  type="button"
                  className="es-chip"
                  aria-pressed={filtro === f}
                  onClick={() => escolherFiltro(f)}
                >
                  {ROTULO_FILTRO[f]}
                  <span className="es-chip__qtd">{contagem[f]}</span>
                </button>
              ))}
              {categoria && !emKits && (
                <button type="button" className="es-pilula" onClick={() => setCategoria('')} aria-label={`Remover filtro da categoria ${categoria}`}>
                  {categoria}
                  {IcFechar}
                </button>
              )}
            </div>

            <div className="es-toolbar__ferramentas">
              <label className="es-busca">
                {IcBuscar}
                <input
                  ref={buscaRef}
                  name="busca_estoque"
                  type="search"
                  value={busca}
                  onChange={e => onBusca(e.target.value)}
                  placeholder={emKits ? 'Buscar kit por nome' : 'Buscar por nome ou aplicação'}
                  aria-label={emKits ? 'Buscar kits por nome' : 'Buscar itens por nome ou aplicação'}
                  autoComplete="off"
                />
              </label>

              <div className="es-filtros" ref={filtrosRef}>
                <button
                  type="button"
                  className="es-btn es-btn--secundario"
                  aria-expanded={filtrosAbertos}
                  aria-haspopup="dialog"
                  disabled={emKits}
                  title={emKits ? 'Os filtros adicionais valem só para itens' : undefined}
                  onClick={() => setFiltrosAbertos(v => !v)}
                >
                  {IcFiltros}
                  Filtros
                  {categoria && <span className="es-btn__contador">1</span>}
                </button>
                {filtrosAbertos && (
                  <div className="es-popover" role="dialog" aria-label="Filtros">
                    <label className="es-campo">
                      <span>Categoria</span>
                      <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                        <option value="">Todas</option>
                        {gruposCategoria.map(g => (
                          <optgroup key={g.grupo} label={g.grupo}>
                            {g.opcoes.map(o => (
                              <option key={o.categoria} value={o.categoria}>{o.categoria} ({o.qtd})</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <div className="es-popover__rodape">
                      <button
                        type="button"
                        className="es-btn es-btn--secundario es-btn--sm"
                        disabled={!categoria}
                        onClick={() => setCategoria('')}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lista */}
          <section className="es-card" aria-label={emKits ? 'Lista de kits' : 'Lista de itens do estoque'}>
            <div className="es-card__rolagem">
              {emKits ? (
                <div role="table" className="es-tabela es-tabela--kits" aria-label="Kits do estoque" aria-busy={carregando}>
                  <div role="rowgroup">
                    <div role="row" className="es-thead">
                      <div role="columnheader">Kit</div>
                      <div role="columnheader">Componentes</div>
                      <div role="columnheader">Disponibilidade</div>
                      <div role="columnheader"><span className="es-sr">Ações</span></div>
                    </div>
                  </div>
                  {!carregando && kitsVisiveis.length > 0 && (
                    <div role="rowgroup">
                      {kitsVisiveis.map(kit => (
                        <KitLinha
                          key={kit.id}
                          kit={kit}
                          itensPorId={itensPorId}
                          disponibilidade={disponibilidadeKit(kit)}
                          aplicando={aplicandoKitId === kit.id}
                          erro={erroAplicarKit[kit.id] ?? null}
                          menuAberto={menu?.id === kit.id}
                          onAbrir={onEditarKit}
                          onAplicar={onAplicarKit}
                          onMenu={abrirMenu('kit')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  role="table"
                  className={`es-tabela${mostrarCusto ? '' : ' es-tabela--sem-custo'}`}
                  aria-label="Itens do estoque"
                  aria-busy={carregando}
                >
                  <div role="rowgroup">
                    <div role="row" className="es-thead">
                      <div role="columnheader">Item</div>
                      <div role="columnheader">Categoria</div>
                      <div role="columnheader" className="es-num">Quantidade</div>
                      {mostrarCusto && <div role="columnheader" className="es-num">Custo un.</div>}
                      <div role="columnheader" className="es-num">Preço un.</div>
                      <div role="columnheader"><span className="es-sr">Ações</span></div>
                    </div>
                  </div>
                  {!carregando && itensVisiveis.length > 0 && (
                    <div role="rowgroup">
                      {itensVisiveis.map(item => (
                        <EstoqueLinha
                          key={item.id}
                          item={item}
                          mostrarCusto={mostrarCusto}
                          menuAberto={menu?.id === item.id}
                          onAbrir={onEditarProduto}
                          onMenu={abrirMenu('item')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {carregando && (
                <div className="es-carregando" aria-busy="true" aria-label="Carregando estoque">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={40} r={6} />)}
                </div>
              )}

              {!carregando && qtdVisiveis === 0 && (
                <div className="es-vazio-estado">
                  <span className="es-vazio-estado__icone">{IcCaixa}</span>
                  <strong>{mensagemVazia.titulo}</strong>
                  <span>{mensagemVazia.texto}</span>
                </div>
              )}
            </div>

            {/* Paginação */}
            {!carregando && total > 0 && (
              <footer className="es-paginacao">
                <span className="es-paginacao__resumo">
                  Mostrando {inicio + 1}–{inicio + qtdVisiveis} de {total}
                </span>
                <button
                  type="button"
                  className="es-btn es-btn--secundario es-btn--sm"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  {IcSetaEsq}
                  Anterior
                </button>
                <button
                  type="button"
                  className="es-btn es-btn--secundario es-btn--sm"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima
                  {IcSetaDir}
                </button>
              </footer>
            )}
          </section>
        </>
      )}

      {/* Menu ⋯ da linha: posição fixa pra não ser cortado pela rolagem da tabela */}
      {menu && (itemDoMenu || kitDoMenu) && (
        <div ref={menuRef} className="es-menu" role="menu" style={{ top: menu.top, right: menu.right }}>
          <button
            type="button" role="menuitem" className="es-menu__item"
            onClick={() => { setMenu(null); if (itemDoMenu) onEditarProduto(itemDoMenu); else if (kitDoMenu) onEditarKit(kitDoMenu); }}
          >
            {IcEditar} Editar
          </button>
          <div className="es-menu__sep" role="separator" />
          <button
            type="button" role="menuitem" className="es-menu__item es-menu__item--perigo"
            onClick={() => { setMenu(null); if (itemDoMenu) onExcluirProduto(itemDoMenu); else if (kitDoMenu) onExcluirKit(kitDoMenu); }}
          >
            {IcLixeira} Excluir
          </button>
        </div>
      )}
    </div>
  );
}

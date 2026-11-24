import { useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '../Primitives';
import { Valor } from '../../../components/Privacidade';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatBRL } from '../../../utils/dashboard';
import { valorOS } from '../../../utils/relatorios';
import type { OrdemRow } from '../../../types/dashboard';
import { Placa } from '../Placa';
import { StatusOS } from './StatusOS';
import {
  IcAbrir, IcBuscar, IcEditar, IcFiltros, IcLixeira, IcMais, IcReticencias, IcSetaDir, IcSetaEsq,
} from './icones';
import {
  FILTROS, ITENS_POR_PAGINA, ROTULO_FILTRO, ROTULO_PERIODO,
  formatarEntrada, mecanicoDaOrdem, noFiltro, noPatio, noPeriodo, veiculoDaOrdem,
} from './ordensUtils';
import type { FiltroStatus, PeriodoEntrada } from './ordensUtils';
import './ordens.css';

interface Props {
  ordens: OrdemRow[];
  loading: boolean;
  filtro: FiltroStatus;
  onFiltro: (f: FiltroStatus) => void;
  busca: string;
  onBusca: (texto: string) => void;
  onNewOS: () => void;
  onAbrir: (o: OrdemRow) => void;
  onEditar: (id: string) => void;
  onExcluir: (id: string) => void;
  excluindoId: string | null;
}

/** Valor da OS para a tabela; null = mostra "—" (orçamento ainda sem valor fechado). */
function valorDaLinha(o: OrdemRow): number | null {
  if (typeof o.valor_total === 'number') return o.valor_total;
  if (o.status === 'rascunho' || o.status === 'em_orcamento') return null;
  return valorOS(o);
}

interface MenuAberto { id: string; top: number; right: number }

export function OrdensDesktop({
  ordens, loading, filtro, onFiltro, busca, onBusca,
  onNewOS, onAbrir, onEditar, onExcluir, excluindoId,
}: Props) {
  const { can } = usePermissions();
  const verValor = can('financeiro.ver');

  const [mecanico, setMecanico] = useState('');
  const [periodo, setPeriodo] = useState<PeriodoEntrada>('todos');
  const [pagina, setPagina] = useState(1);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [menu, setMenu] = useState<MenuAberto | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);
  const filtrosRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const contagem = useMemo(
    () => Object.fromEntries(FILTROS.map(f => [f, ordens.filter(o => noFiltro(o.status, f)).length])) as Record<FiltroStatus, number>,
    [ordens],
  );
  const noPatioAgora = useMemo(() => ordens.filter(noPatio).length, [ordens]);
  const mecanicos = useMemo(
    () => [...new Set(ordens.map(mecanicoDaOrdem).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [ordens],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase().replace(/^#/, '');
    return ordens
      .filter(o => {
        if (!noFiltro(o.status, filtro)) return false;
        if (!noPeriodo(o, periodo)) return false;
        if (mecanico && mecanicoDaOrdem(o) !== mecanico) return false;
        if (!q) return true;
        return o.os_num.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q) ||
          o.placa.toLowerCase().includes(q) || (o.modelo ?? '').toLowerCase().includes(q);
      })
      // mais recentes primeiro
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ordens, filtro, periodo, mecanico, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const visiveis = filtradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  const filtrosAtivos = (mecanico ? 1 : 0) + (periodo !== 'todos' ? 1 : 0);

  // Mudou o recorte: volta pra primeira página.
  useEffect(() => { setPagina(1); }, [filtro, busca, mecanico, periodo]);

  // ── Popovers: fechar com Esc / clique fora / rolagem ───────────────────────
  useEffect(() => {
    if (!filtrosAbertos && !menu) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (filtrosAbertos && !filtrosRef.current?.contains(alvo)) setFiltrosAbertos(false);
      if (menu && !menuRef.current?.contains(alvo) && !(alvo as HTMLElement).closest?.('[data-os-menu-gatilho]')) setMenu(null);
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

  const abrirMenu = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (menu?.id === id) { setMenu(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ id, top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  const ordemDoMenu = menu ? ordens.find(o => o.id === menu.id) : undefined;

  return (
    <div className="os-page">
      {/* Cabeçalho da página */}
      <header className="os-header">
        <div className="os-header__titulos">
          <h1 className="os-titulo">Ordens de serviço</h1>
          <p className="os-subtitulo">
            {ordens.length} {ordens.length === 1 ? 'ordem' : 'ordens'} · {noPatioAgora} na oficina agora
          </p>
        </div>
        <button type="button" className="os-btn os-btn--primario" onClick={onNewOS}>
          {IcMais}
          Nova OS
        </button>
      </header>

      {/* Barra de filtros */}
      <div className="os-toolbar">
        <div className="os-chips" role="group" aria-label="Filtrar por status">
          {FILTROS.map(f => (
            <button
              key={f}
              type="button"
              className="os-chip"
              aria-pressed={filtro === f}
              onClick={() => onFiltro(f)}
            >
              {ROTULO_FILTRO[f]}
              <span className="os-chip__qtd">{contagem[f]}</span>
            </button>
          ))}
        </div>

        <div className="os-toolbar__ferramentas">
          <label className="os-busca">
            {IcBuscar}
            <input
              ref={buscaRef}
              name="busca_ordens"
              type="search"
              value={busca}
              onChange={e => onBusca(e.target.value)}
              placeholder="Buscar por nº, cliente ou placa"
              aria-label="Buscar ordens por número, cliente ou placa"
              autoComplete="off"
            />
          </label>

          <div className="os-filtros" ref={filtrosRef}>
            <button
              type="button"
              className="os-btn os-btn--secundario"
              aria-expanded={filtrosAbertos}
              aria-haspopup="dialog"
              onClick={() => setFiltrosAbertos(v => !v)}
            >
              {IcFiltros}
              Filtros
              {filtrosAtivos > 0 && <span className="os-btn__contador">{filtrosAtivos}</span>}
            </button>
            {filtrosAbertos && (
              <div className="os-popover" role="dialog" aria-label="Filtros">
                <label className="os-campo">
                  <span>Mecânico</span>
                  <select value={mecanico} onChange={e => setMecanico(e.target.value)}>
                    <option value="">Todos</option>
                    {mecanicos.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="os-campo">
                  <span>Entrada</span>
                  <select value={periodo} onChange={e => setPeriodo(e.target.value as PeriodoEntrada)}>
                    {(Object.keys(ROTULO_PERIODO) as PeriodoEntrada[]).map(p => (
                      <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>
                    ))}
                  </select>
                </label>
                <div className="os-popover__rodape">
                  <button
                    type="button"
                    className="os-btn os-btn--secundario os-btn--sm"
                    disabled={filtrosAtivos === 0}
                    onClick={() => { setMecanico(''); setPeriodo('todos'); }}
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
      <section className="os-card" aria-label="Lista de ordens de serviço">
        <div className="os-card__rolagem">
          <table className="os-tabela">
            <colgroup>
              <col style={{ width: 104 }} />
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 176 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 104 }} />
              {verValor && <col style={{ width: 120 }} />}
              <col style={{ width: 56 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Nº OS</th>
                <th scope="col">Cliente / veículo</th>
                <th scope="col">Placa</th>
                <th scope="col">Status</th>
                <th scope="col">Mecânico</th>
                <th scope="col">Entrada</th>
                {verValor && <th scope="col" className="os-num">Valor</th>}
                <th scope="col"><span className="os-sr">Ações</span></th>
              </tr>
            </thead>
            {!loading && visiveis.length > 0 && (
              <tbody>
                {visiveis.map(o => {
                  const mec = mecanicoDaOrdem(o);
                  const valor = valorDaLinha(o);
                  return (
                    <tr
                      key={o.id}
                      className={`os-linha${menu?.id === o.id ? ' os-linha--menu' : ''}`}
                      tabIndex={0}
                      aria-label={`Abrir OS ${o.os_num} de ${o.cliente}`}
                      onClick={() => onAbrir(o)}
                      onKeyDown={e => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(o); }
                      }}
                    >
                      <td className="os-cel-os">#{o.os_num}</td>
                      <td>
                        <div className="os-cliente">{o.cliente}</div>
                        <div className="os-veiculo">{veiculoDaOrdem(o)}</div>
                      </td>
                      <td><Placa placa={o.placa} /></td>
                      <td><StatusOS status={o.status} /></td>
                      <td className="os-cel-mecanico">{mec ?? <span className="os-vazio">—</span>}</td>
                      <td className="os-cel-entrada">{formatarEntrada(o.created_at)}</td>
                      {verValor && (
                        <td className="os-num os-cel-valor">
                          {valor === null ? <span className="os-vazio">—</span> : <Valor texto={formatBRL(valor)} />}
                        </td>
                      )}
                      <td className="os-cel-acoes">
                        <button
                          type="button"
                          className="os-mais"
                          data-os-menu-gatilho
                          aria-label={`Mais ações da OS ${o.os_num}`}
                          aria-haspopup="menu"
                          aria-expanded={menu?.id === o.id}
                          onClick={e => abrirMenu(e, o.id)}
                          onKeyDown={e => e.stopPropagation()}
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
            <div className="os-carregando" aria-busy="true" aria-label="Carregando ordens">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={20} r={4} />)}
            </div>
          )}

          {!loading && visiveis.length === 0 && (
            <div className="os-vazio-estado">
              <strong>Nenhuma ordem encontrada</strong>
              <span>Ajuste os filtros ou crie uma nova OS</span>
            </div>
          )}
        </div>

        {/* Paginação */}
        {!loading && filtradas.length > 0 && (
          <footer className="os-paginacao">
            <span className="os-paginacao__resumo">
              Mostrando {inicio + 1}–{inicio + visiveis.length} de {filtradas.length}
            </span>
            <button
              type="button"
              className="os-btn os-btn--secundario os-btn--sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              {IcSetaEsq}
              Anterior
            </button>
            <button
              type="button"
              className="os-btn os-btn--secundario os-btn--sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
            >
              Próxima
              {IcSetaDir}
            </button>
          </footer>
        )}
      </section>

      {/* Menu ⋯ da linha: posição fixa pra não ser cortado pela rolagem da tabela */}
      {menu && ordemDoMenu && (
        <div
          ref={menuRef}
          className="os-menu"
          role="menu"
          style={{ top: menu.top, right: menu.right }}
        >
          <button type="button" role="menuitem" className="os-menu__item" onClick={() => { setMenu(null); onAbrir(ordemDoMenu); }}>
            {IcAbrir} Ver detalhes
          </button>
          <button type="button" role="menuitem" className="os-menu__item" onClick={() => { setMenu(null); onEditar(ordemDoMenu.id); }}>
            {IcEditar} Editar
          </button>
          <div className="os-menu__sep" role="separator" />
          <button
            type="button" role="menuitem" className="os-menu__item os-menu__item--perigo"
            disabled={excluindoId === ordemDoMenu.id}
            onClick={() => { setMenu(null); onExcluir(ordemDoMenu.id); }}
          >
            {IcLixeira} Excluir
          </button>
        </div>
      )}
    </div>
  );
}

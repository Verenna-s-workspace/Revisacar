import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Skeleton } from '../Primitives';
import { Valor } from '../../../components/Privacidade';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatBRL } from '../../../utils/dashboard';
import { valorOS } from '../../../utils/relatorios';
import type { OrdemRow } from '../../../types/dashboard';
import { Placa } from '../Placa';
import { StatusOS } from './StatusOS';
import { IcBuscar, IcEditar, IcLixeira } from './icones';
import {
  FILTROS_MOBILE, ROTULO_FILTRO_MOBILE, ROTULO_SECAO,
  mecanicoDaOrdem, noFiltroMobile, noPatio, secaoDaData,
} from './ordensUtils';
import type { FiltroMobile, SecaoData } from './ordensUtils';
import './OrdensMobile.css';

interface Props {
  ordens: OrdemRow[];
  loading: boolean;
  onAbrir: (o: OrdemRow) => void;
  onEditar: (id: string) => void;
  onExcluir: (id: string) => void;
  excluindoId: string | null;
}

/** Mesmo critério do desktop: orçamento sem valor fechado mostra "—". */
function valorDaLinha(o: OrdemRow): number | null {
  if (typeof o.valor_total === 'number') return o.valor_total;
  if (o.status === 'rascunho' || o.status === 'em_orcamento') return null;
  return valorOS(o);
}

const POR_PAGINA = 20;
/** Largura da área de ações que aparece ao deslizar a linha para a esquerda. */
const LARGURA_ACOES = 144;
const ORDEM_SECOES: SecaoData[] = ['recentes', 'semana', 'antigas'];

interface Gesto { id: string; x0: number; y0: number; base: number; horizontal: boolean | null; moveu: boolean }

export function OrdensMobile({ ordens, loading, onAbrir, onEditar, onExcluir, excluindoId }: Props) {
  const { can } = usePermissions();
  const verValor = can('financeiro.ver');

  const [filtro, setFiltro] = useState<FiltroMobile>('patio');
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberto, setAberto] = useState<string | null>(null);          // linha com as ações à mostra
  const [arrasto, setArrasto] = useState<{ id: string; x: number } | null>(null);

  const buscaRef = useRef<HTMLInputElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const suprimirClique = useRef(false);

  const buscando = busca.trim().length > 0;
  // Enquanto há texto na busca ela procura em TODAS as ordens (o chip não esconde resultado).
  const filtroEfetivo: FiltroMobile = buscando ? 'todas' : filtro;

  const contagem = useMemo(
    () => Object.fromEntries(FILTROS_MOBILE.map(f => [f, ordens.filter(o => noFiltroMobile(o.status, f)).length])) as Record<FiltroMobile, number>,
    [ordens],
  );
  const noPatioAgora = useMemo(() => ordens.filter(noPatio).length, [ordens]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase().replace(/^#/, '');
    return ordens
      .filter(o => {
        if (!noFiltroMobile(o.status, filtroEfetivo)) return false;
        if (!q) return true;
        return o.os_num.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q) ||
          o.placa.toLowerCase().includes(q) || (o.modelo ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ordens, busca, filtroEfetivo]);

  useEffect(() => { setLimite(POR_PAGINA); setAberto(null); }, [filtro, busca]);

  const visiveis = filtradas.slice(0, limite);
  const restantes = filtradas.length - visiveis.length;

  const secoes = useMemo(() => {
    const agora = new Date();
    const grupos: Record<SecaoData, OrdemRow[]> = { recentes: [], semana: [], antigas: [] };
    for (const o of visiveis) grupos[secaoDaData(o.created_at, agora)].push(o);
    return ORDEM_SECOES.filter(s => grupos[s].length > 0).map(s => ({ id: s, itens: grupos[s] }));
  }, [visiveis]);

  // Toque fora da linha aberta fecha as ações.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('.osm-item--aberta')) setAberto(null);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  // ── Deslizar para mostrar ações ─────────────────────────────────────────────
  const aoPressionar = (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesto.current = { id, x0: e.clientX, y0: e.clientY, base: aberto === id ? -LARGURA_ACOES : 0, horizontal: null, moveu: false };
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
      // O "click" que o navegador dispara depois do arrasto não deve abrir a OS.
      suprimirClique.current = true;
      window.setTimeout(() => { suprimirClique.current = false; }, 60);
    }
    setArrasto(null);
  };

  const aoTocar = (o: OrdemRow) => {
    if (suprimirClique.current) return;
    if (aberto) { setAberto(null); return; }
    onAbrir(o);
  };

  const focarBusca = () => {
    buscaRef.current?.scrollIntoView({ block: 'nearest' });
    buscaRef.current?.focus();
  };

  return (
    <div className="osm-page">
      {/* Topo: título + busca */}
      <header className="osm-topo">
        <div className="osm-barra">
          <div className="osm-barra__titulos">
            <h1 className="osm-titulo">Ordens</h1>
            <p className="osm-subtitulo">
              {ordens.length} {ordens.length === 1 ? 'ordem' : 'ordens'} · {noPatioAgora} no pátio
            </p>
          </div>
          <button type="button" className="osm-acao" aria-label="Buscar ordens" onClick={focarBusca}>
            {IcBuscar}
          </button>
        </div>

        <div className="osm-busca-linha">
          <label className="osm-busca">
            {IcBuscar}
            <input
              ref={buscaRef}
              name="busca_ordens"
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar nº, cliente ou placa"
              aria-label="Buscar ordens por número, cliente ou placa"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
        </div>

        <div className="osm-filtros" role="group" aria-label="Filtrar por status">
          {FILTROS_MOBILE.map(f => (
            <button
              key={f}
              type="button"
              className="osm-chip"
              aria-pressed={!buscando && filtro === f}
              onClick={() => { setBusca(''); setFiltro(f); }}
            >
              {ROTULO_FILTRO_MOBILE[f]}
              <span className="osm-chip__qtd">{contagem[f]}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Lista */}
      <section className="osm-lista" aria-label="Lista de ordens de serviço" aria-busy={loading}>
        {loading ? (
          <div className="osm-carregando">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={66} r={6} />)}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="osm-vazio">
            <strong>Nenhuma ordem encontrada</strong>
            <span>{buscando ? 'Tente outro número, nome ou placa' : 'Nenhuma OS neste filtro'}</span>
          </div>
        ) : (
          <>
            {secoes.map(secao => (
              <div key={secao.id}>
                <h2 className="osm-secao">{ROTULO_SECAO[secao.id]}</h2>
                <ul className="osm-itens">
                  {secao.itens.map(o => {
                    const valor = valorDaLinha(o);
                    const mec = mecanicoDaOrdem(o);
                    const detalhe = [o.modelo, mec ?? (o.status === 'aprovada' ? 'sem mecânico' : '')].filter(Boolean).join(' · ');
                    const mostraAcoes = aberto === o.id || arrasto?.id === o.id;
                    const x = arrasto?.id === o.id ? arrasto.x : aberto === o.id ? -LARGURA_ACOES : 0;
                    return (
                      <li key={o.id} className={`osm-item${aberto === o.id ? ' osm-item--aberta' : ''}`}>
                        {mostraAcoes && (
                          <div className="osm-acoes" style={{ width: LARGURA_ACOES }}>
                            <button type="button" className="osm-acoes__btn" onClick={() => { setAberto(null); onEditar(o.id); }}>
                              {IcEditar}
                              Editar
                            </button>
                            <button
                              type="button"
                              className="osm-acoes__btn osm-acoes__btn--perigo"
                              disabled={excluindoId === o.id}
                              onClick={() => { setAberto(null); onExcluir(o.id); }}
                            >
                              {IcLixeira}
                              Excluir
                            </button>
                          </div>
                        )}
                        <div
                          className="osm-cartao"
                          role="button"
                          tabIndex={0}
                          aria-label={`Abrir OS ${o.os_num} de ${o.cliente}`}
                          style={{ transform: `translateX(${x}px)`, transition: arrasto?.id === o.id ? 'none' : undefined }}
                          onPointerDown={e => aoPressionar(e, o.id)}
                          onPointerMove={aoMover}
                          onPointerUp={aoSoltar}
                          onPointerCancel={aoSoltar}
                          onClick={() => aoTocar(o)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoTocar(o); }
                          }}
                        >
                          <div className="osm-linha1">
                            <span className="osm-os">#{o.os_num}</span>
                            <StatusOS status={o.status} />
                          </div>
                          <div className="osm-linha2">
                            <Placa placa={o.placa} />
                            <div className="osm-cliente">
                              <span className="osm-cliente__nome">{o.cliente}</span>
                              <span className="osm-cliente__detalhe">{detalhe || '—'}</span>
                            </div>
                            {verValor && (
                              <span className="osm-valor">
                                {valor === null ? '—' : <Valor texto={formatBRL(valor)} />}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {restantes > 0 && (
              <button type="button" className="osm-mais" onClick={() => setLimite(l => l + POR_PAGINA)}>
                Mostrar mais {Math.min(restantes, POR_PAGINA)}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
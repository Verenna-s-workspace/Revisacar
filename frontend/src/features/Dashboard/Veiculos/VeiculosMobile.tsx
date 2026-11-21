import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
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
  IcBuscar,
  IcDesvincular,
  IcEditar,
  IcFechar,
  IcFiltros,
  IcLixeira,
  IcMais,
  IcOlho,
  IcReticencias,
  IcSetaEsq,
  IcUsuario,
} from './icones';
import '../Ordens/Status.css';
import './VeiculosMobile.css';

const POR_PAGINA = 20;
const LARGURA_ACOES = 144;

const CLASSE_STATUS: Record<VeiculoStatus, string> = {
  disponivel: '',
  na_oficina: 'os-status--em_execucao',
  aguardando_aprovacao: 'os-status--pendente_aprovacao',
  pronto_entrega: 'os-status--finalizada',
};

const ROTULO_STATUS: Record<VeiculoStatus, string> = {
  disponivel: 'Disponível',
  na_oficina: 'Na oficina',
  aguardando_aprovacao: 'Aguardando aprovação',
  pronto_entrega: 'Pronto p/ entrega',
};

interface Gesto {
  id: string;
  x0: number;
  y0: number;
  base: number;
  horizontal: boolean | null;
  moveu: boolean;
}

interface VeiculosMobileProps {
  veiculos: VeiculoCadastrado[];
  totalVeiculos: number;
  stats: VeiculoStats;
  ordens: OrdemRow[];
  loading: boolean;
  erro: string | null;
  search: string;
  filtros: VeiculoFiltros;
  onVoltar: () => void;
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

export function VeiculosMobile({
  veiculos,
  totalVeiculos,
  stats,
  ordens,
  loading,
  erro,
  search,
  filtros,
  onVoltar,
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
}: VeiculosMobileProps) {
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberto, setAberto] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<{ id: string; x: number } | null>(null);
  const [acaoItem, setAcaoItem] = useState<VeiculoCadastrado | null>(null);

  const gesto = useRef<Gesto | null>(null);
  const suprimirClique = useRef(false);

  const hasActiveFilters = filtrosAtivos(filtros) || search.trim().length > 0;
  const qtdFiltros = contarFiltrosAvancados(filtros);

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

  useEffect(() => {
    setLimite(POR_PAGINA);
    setAberto(null);
  }, [filtros, search]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('.vem-item--aberta')) setAberto(null);
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

  const visiveis = veiculos.slice(0, limite);
  const restantes = veiculos.length - visiveis.length;

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

  const aoTocar = (v: VeiculoCadastrado) => {
    if (suprimirClique.current) return;
    if (aberto) { setAberto(null); return; }
    onView(v);
  };

  const chips: { id: VeiculoStatus | 'todos'; rotulo: string; qtd: number }[] = [
    { id: 'todos', rotulo: 'Todos', qtd: stats.total },
    { id: 'na_oficina', rotulo: 'Na oficina', qtd: stats.naOficina },
    { id: 'aguardando_aprovacao', rotulo: 'Aguardando', qtd: stats.aguardandoAprovacao },
    { id: 'pronto_entrega', rotulo: 'Prontos', qtd: stats.prontoEntrega },
  ];

  const subtitulo = `${totalVeiculos} ${totalVeiculos === 1 ? 'veículo' : 'veículos'} · ${stats.naOficina} na oficina`;

  return (
    <div className="vem-page">
      {/* Topo */}
      <header className="vem-topo">
        <div className="vem-barra">
          <button
            type="button"
            className="vem-voltar"
            onClick={onVoltar}
            aria-label="Voltar para a Visão Geral"
          >
            {IcSetaEsq}
          </button>

          <div className="vem-barra__titulos">
            <h1 className="vem-titulo">Veículos</h1>
            <p className="vem-subtitulo">{loading ? 'Carregando veículos…' : subtitulo}</p>
          </div>

          <button
            type="button"
            className="vem-acao"
            onClick={onNovoVeiculo}
            aria-label="Cadastrar veículo"
          >
            {IcMais}
          </button>
        </div>

        <div className="vem-busca-linha">
          <label className="vem-busca">
            {IcBuscar}
            <input
              name="busca_veiculos_mobile"
              type="search"
              value={search}
              onChange={e => onSearch(e.target.value)}
              placeholder="Buscar placa, modelo ou dono"
              aria-label="Buscar veículos por placa, marca, modelo ou proprietário"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>

          <button
            type="button"
            className="vem-filtros-btn"
            aria-haspopup="dialog"
            onClick={onOpenFilters}
          >
            {IcFiltros}
            Filtros
            {qtdFiltros > 0 && <span className="vem-filtros-btn__contador">{qtdFiltros}</span>}
          </button>
        </div>

        <div className="vem-filtros" role="group" aria-label="Filtrar veículos por situação">
          {chips.map(c => (
            <button
              key={c.id}
              type="button"
              className="vem-chip"
              aria-pressed={filtros.status === c.id}
              onClick={() => onFiltros({ ...filtros, status: c.id })}
            >
              {c.rotulo}
              <span className="vem-chip__qtd">{c.qtd}</span>
            </button>
          ))}

          {filtros.categoria !== 'todas' && (
            <button
              type="button"
              className="vem-pilula"
              onClick={() => onFiltros({ ...filtros, categoria: 'todas' })}
            >
              {CATEGORIA_LABEL[filtros.categoria]}
              {IcFechar}
            </button>
          )}

          {filtros.vinculo !== 'todos' && (
            <button
              type="button"
              className="vem-pilula"
              onClick={() => onFiltros({ ...filtros, vinculo: 'todos' })}
            >
              {filtros.vinculo === 'com' ? 'Com proprietário' : 'Sem proprietário'}
              {IcFechar}
            </button>
          )}
        </div>
      </header>

      {erro && !loading && (
        <div className="vem-aviso os-status--recusada" role="alert">
          <span>{erro}</span>
          <button type="button" className="vem-aviso__btn" onClick={onRecarregar}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Lista */}
      <section className="vem-lista" aria-label="Lista de veículos" aria-busy={loading}>
        {loading ? (
          <div className="vem-carregando">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={72} r={6} />)}
          </div>
        ) : visiveis.length === 0 ? (
          <div className="vem-vazio">
            <strong>{totalVeiculos > 0 ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}</strong>
            <span>
              {totalVeiculos > 0
                ? 'Ajuste a busca ou os filtros aplicados.'
                : 'Comece cadastrando o primeiro veículo da oficina.'}
            </span>
            {hasActiveFilters ? (
              <button type="button" className="vem-vazio__btn" onClick={onClearFilters}>
                Limpar filtros
              </button>
            ) : (
              <button type="button" className="vem-vazio__btn vem-vazio__btn--primario" onClick={onNovoVeiculo}>
                Cadastrar veículo
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="vem-itens">
              {visiveis.map(v => {
                const titulo = `${[v.marca, v.modelo].filter(Boolean).join(' ')}${v.ano ? ` · ${v.ano}` : ''}`;
                const ultimaOS = ultimaOSPorVeiculo(v);
                const dataOS = formatarDataOS(ultimaOS?.created_at);
                const metaTopo = [formatKm(v.quilometragem), dataOS ? `OS ${dataOS}` : null].filter(Boolean).join(' · ');
                const detalhe = [v.proprietario?.nome || 'Sem proprietário', CATEGORIA_LABEL[v.categoria]].filter(Boolean).join(' · ');
                const statusLabel = ROTULO_STATUS[v.status] ?? VEICULO_STATUS_CONFIG[v.status].label;

                const mostraAcoes = aberto === v.id || arrasto?.id === v.id;
                const x = arrasto?.id === v.id ? arrasto.x : aberto === v.id ? -LARGURA_ACOES : 0;

                return (
                  <li key={v.id} className={`vem-item${aberto === v.id ? ' vem-item--aberta' : ''}`}>
                    {mostraAcoes && (
                      <div className="vem-acoes" style={{ width: LARGURA_ACOES }}>
                        <button
                          type="button"
                          className="vem-acoes__btn"
                          onClick={() => { setAberto(null); onEdit(v); }}
                        >
                          {IcEditar}
                          Editar
                        </button>
                        <button
                          type="button"
                          className="vem-acoes__btn vem-acoes__btn--perigo"
                          onClick={() => { setAberto(null); onDelete(v); }}
                        >
                          {IcLixeira}
                          Excluir
                        </button>
                      </div>
                    )}

                    <div
                      className="vem-cartao"
                      role="button"
                      tabIndex={0}
                      aria-label={`Visualizar ${v.marca} ${v.modelo} (${v.placa})`}
                      style={{ transform: `translateX(${x}px)`, transition: arrasto?.id === v.id ? 'none' : undefined }}
                      onPointerDown={e => aoPressionar(e, v.id)}
                      onPointerMove={aoMover}
                      onPointerUp={aoSoltar}
                      onPointerCancel={aoSoltar}
                      onClick={() => aoTocar(v)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          aoTocar(v);
                        }
                      }}
                    >
                      <div className="vem-linha1">
                        <span className={`os-status ${CLASSE_STATUS[v.status]}`.trim()}>
                          <span className="os-status__dot" aria-hidden="true" />
                          {statusLabel}
                        </span>
                        <span className="vem-meta-topo">{metaTopo}</span>
                        <button
                          type="button"
                          className="vem-mais-btn"
                          aria-label={`Mais ações de ${v.marca} ${v.modelo}`}
                          aria-haspopup="dialog"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setAberto(null); setAcaoItem(v); }}
                        >
                          {IcReticencias}
                        </button>
                      </div>

                      <div className="vem-linha2">
                        <VeiculoFoto src={v.fotoPrincipal} />
                        <div className="vem-info">
                          <span className="vem-info__nome">{titulo}</span>
                          <span className="vem-info__detalhe">{detalhe}</span>
                        </div>
                        <div className="vem-placa-wrap">
                          <Placa placa={v.placa} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {restantes > 0 && (
              <button type="button" className="vem-mais-pag" onClick={() => setLimite(l => l + POR_PAGINA)}>
                Mostrar mais {Math.min(restantes, POR_PAGINA)}
              </button>
            )}
          </>
        )}
      </section>

      {/* Bottom Sheet: ações completas do veículo */}
      {acaoItem &&
        createPortal(
          <div className="vem-sheet-backdrop" onClick={() => setAcaoItem(null)}>
            <div
              className="vem-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Ações para ${acaoItem.marca} ${acaoItem.modelo}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="vem-sheet__grab" aria-hidden="true" />
              <h2 className="vem-sheet__titulo">{acaoItem.marca} {acaoItem.modelo}</h2>
              <p className="vem-sheet__sub">
                {acaoItem.placa} · {acaoItem.proprietario?.nome || 'Sem proprietário'}
              </p>

              <button
                type="button"
                className="vem-sheet__opt"
                onClick={() => { const v = acaoItem; setAcaoItem(null); onView(v); }}
              >
                {IcOlho}
                Visualizar detalhes
              </button>

              <button
                type="button"
                className="vem-sheet__opt"
                onClick={() => { const v = acaoItem; setAcaoItem(null); onEdit(v); }}
              >
                {IcEditar}
                Editar veículo
              </button>

              <button
                type="button"
                className="vem-sheet__opt"
                onClick={() => { const v = acaoItem; setAcaoItem(null); onNovaOS(v); }}
              >
                {IcMais}
                Nova OS
              </button>

              <button
                type="button"
                className="vem-sheet__opt"
                onClick={() => { const v = acaoItem; setAcaoItem(null); onChangeOwner(v); }}
              >
                {IcUsuario}
                {acaoItem.proprietario ? 'Alterar proprietário' : 'Vincular proprietário'}
              </button>

              {acaoItem.proprietario && (
                <button
                  type="button"
                  className="vem-sheet__opt"
                  onClick={() => { const v = acaoItem; setAcaoItem(null); onUnlinkOwner(v); }}
                >
                  {IcDesvincular}
                  Desvincular proprietário
                </button>
              )}

              <button
                type="button"
                className="vem-sheet__opt vem-sheet__opt--perigo"
                onClick={() => { const v = acaoItem; setAcaoItem(null); onDelete(v); }}
              >
                {IcLixeira}
                Excluir veículo
              </button>

              <button type="button" className="vem-sheet__cancel" onClick={() => setAcaoItem(null)}>
                Cancelar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
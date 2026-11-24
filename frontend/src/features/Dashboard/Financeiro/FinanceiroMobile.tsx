import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '../Primitives';
import { Valor, GraficoPrivado, BotaoPrivacidade } from '../../../components/Privacidade';
import { usePrivacidade } from '../../../context/PrivacidadeContext';
import { formatBRL } from '../../../utils/dashboard';
import {
  FILTROS_VAZIOS, ROTULO_PERIODO, contarFiltrosAtivos, descreverPeriodo, filtrarLancamentos, fluxoDeCaixa,
  intervaloCurto, lancamentosParaCsv, normalizarTexto, dataCompleta, diaMes,
} from '../../../utils/financeiro_utils';
import type { FiltrosLancamentos, PeriodoId } from '../../../utils/financeiro_utils';
import { IcBuscar, IcCalendario, IcEditar, IcFechar, IcFiltros, IcLixeira, IcMais, IcReticencias } from '../Clientes/icones';
import { IcConfirmar, IcExportar, IcPagar, IcReceber, IcVazio } from './icones';
import { labelCategoria, LABEL_FORMA_PAGAMENTO, LABEL_STATUS, PALETA_DONUT } from './categoriaLabels';
import { dataLimiteConta, formatDataCurta, ordenarPorUrgencia, somaValores } from './contasUtils';
import { classeStatus, nomeDoLancamento, rotuloStatus } from './lancamentoUtils';
import { FluxoCaixaBarras } from './FluxoCaixaBarras';
import { ReservaMobile } from './ReservaMobile';
import { LancamentoSheet } from './LancamentoSheet';
import { PeriodoModal } from './PeriodoModal';
import { FiltrosLancamentosModal } from './FiltrosLancamentosModal';
import type { FinanceiroDesktopProps } from './FinanceiroDesktop';
import type { TipoContas } from './ContasWidget';
import type { Transacao } from './types';
import '../Ordens/Status.css';
// Os modais de Período e Filtros usam as classes .fin-opcoes / .fin-seg / .fin-chip, que vivem no CSS do desktop.
import './financeiroDesktop.css';
import './FinanceiroMobile.css';

const POR_PAGINA = 20;
const LARGURA_ACAO = 72;
const ATALHOS_PERIODO: PeriodoId[] = ['este-mes', 'mes-passado', 'esta-semana', 'ultima-semana', 'trimestre'];

type Aba = 'lancamentos' | 'contas' | 'graficos';
type FiltroConta = 'todas' | 'vencidas' | 'a-vencer';

/** Mesmas props do desktop, menos "Ver todas": no celular a aba Contas já lista tudo. */
export type FinanceiroMobileProps = Omit<FinanceiroDesktopProps, 'onVerTodasContas'>;

interface Gesto {
  id: string;
  x0: number;
  y0: number;
  base: number;
  largura: number;
  horizontal: boolean | null;
  moveu: boolean;
}

interface AcaoLinha {
  id: string;
  rotulo: string;
  icone: ReactNode;
  perigo?: boolean;
  ok?: boolean;
  executar: () => void;
}

function Kpi({ id, rotulo, valor, contexto, alerta, negativo, destaque }: {
  id?: string; rotulo: string; valor: number; contexto?: ReactNode; alerta?: boolean; negativo?: boolean; destaque?: boolean;
}) {
  return (
    <div className={`finm-kpi${destaque ? ' finm-kpi--destaque' : ''}`} data-destaque-id={id}>
      <span className="finm-kpi__rotulo">{rotulo}</span>
      <span className={`finm-kpi__valor${negativo ? ' finm-kpi__valor--negativo' : ''}`}><Valor texto={formatBRL(valor)} /></span>
      {contexto && <span className={`finm-kpi__contexto${alerta ? ' finm-kpi__contexto--alerta' : ''}`}>{contexto}</span>}
    </div>
  );
}

export function FinanceiroMobile(p: FinanceiroMobileProps) {
  const { oculto } = usePrivacidade();

  const [aba, setAba] = useState<Aba>('lancamentos');
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalFiltros, setModalFiltros] = useState(false);

  // ── Lançamentos ───────────────────────────────────────────────────────────
  const [filtros, setFiltros] = useState<FiltrosLancamentos>(FILTROS_VAZIOS);
  const [busca, setBusca] = useState('');
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberto, setAberto] = useState<string | null>(null);
  const [arrasto, setArrasto] = useState<{ id: string; x: number } | null>(null);
  const [itemSheet, setItemSheet] = useState<Transacao | null>(null);
  const gesto = useRef<Gesto | null>(null);
  const suprimirClique = useRef(false);

  // ── Contas ────────────────────────────────────────────────────────────────
  const [contasTipo, setContasTipo] = useState<TipoContas>('receber');
  const [contasFiltro, setContasFiltro] = useState<FiltroConta>('todas');
  const [contasBusca, setContasBusca] = useState('');
  const [contasLimite, setContasLimite] = useState(POR_PAGINA);

  // Trocou o período: as datas do filtro (que valiam pro período antigo) saem e a lista volta ao começo.
  useEffect(() => {
    setFiltros(f => (f.de || f.ate ? { ...f, de: '', ate: '' } : f));
    setLimite(POR_PAGINA);
  }, [p.de, p.ate]);

  useEffect(() => {
    setLimite(POR_PAGINA);
    setAberto(null);
  }, [filtros, busca]);

  useEffect(() => { setContasLimite(POR_PAGINA); }, [contasTipo, contasFiltro, contasBusca]);

  // Toque fora do cartão aberto recolhe as ações reveladas pelo deslize.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('.finm-item--aberta')) setAberto(null);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  const filtrados = useMemo(
    () => filtrarLancamentos(p.transacoes, filtros, busca, labelCategoria),
    [p.transacoes, filtros, busca],
  );
  const visiveis = filtrados.slice(0, limite);
  const restantes = filtrados.length - visiveis.length;

  const fluxo = useMemo(() => fluxoDeCaixa(p.transacoes, p.de, p.ate), [p.transacoes, p.de, p.ate]);

  const despesas = useMemo(() => {
    const porCat = new Map<string, number>();
    for (const t of p.transacoes) if (t.tipo === 'saida') porCat.set(t.categoria, (porCat.get(t.categoria) ?? 0) + t.valor);
    const lista = Array.from(porCat, ([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
    return { lista, total: lista.reduce((s, d) => s + d.valor, 0) };
  }, [p.transacoes]);

  const contasDoTipo = contasTipo === 'receber' ? p.pendentesReceber : p.pendentesPagar;
  const contasOrdenadas = useMemo(() => ordenarPorUrgencia(contasDoTipo), [contasDoTipo]);
  const contasVencidas = useMemo(() => contasOrdenadas.filter(t => t.vencido), [contasOrdenadas]);
  const contasAVencer = useMemo(() => contasOrdenadas.filter(t => !t.vencido), [contasOrdenadas]);
  const contasVisiveis = useMemo(() => {
    const base = contasFiltro === 'vencidas' ? contasVencidas : contasFiltro === 'a-vencer' ? contasAVencer : contasOrdenadas;
    const termo = normalizarTexto(contasBusca.trim());
    if (!termo) return base;
    return base.filter(t => normalizarTexto(`${t.descricao} ${labelCategoria(t.tipo, t.categoria)} ${t.cliente_nome}`).includes(termo));
  }, [contasFiltro, contasBusca, contasOrdenadas, contasVencidas, contasAVencer]);

  const nFiltros = contarFiltrosAtivos(filtros);
  const resumo = p.resumo;
  const lucroNegativo = !!resumo && resumo.lucro !== undefined && resumo.lucro < 0 && !oculto;
  const temReserva = !!p.reserva && (p.reserva.ativa || p.reserva.movimentos.length > 0);
  const vencidasTotal = p.pendentesReceber.filter(t => t.vencido).length + p.pendentesPagar.filter(t => t.vencido).length;
  const pendentesTotal = p.pendentesReceber.length + p.pendentesPagar.length;

  const exportar = () => {
    const csv = lancamentosParaCsv(
      filtrados, labelCategoria, f => LABEL_FORMA_PAGAMENTO[f] ?? f,
      s => LABEL_STATUS[s] ?? s,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lancamentos_${p.de}_${p.ate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Critérios ligados nos Filtros viram pílulas que se removem com um toque.
  const pilulas: { chave: string; texto: string; remover: () => void }[] = [];
  if (filtros.tipo !== 'todos') pilulas.push({ chave: 'tipo', texto: filtros.tipo === 'entrada' ? 'Entradas' : 'Saídas', remover: () => setFiltros(f => ({ ...f, tipo: 'todos' })) });
  if (filtros.status !== 'todos') pilulas.push({ chave: 'status', texto: `Status: ${filtros.status === 'pago' ? 'Pago' : filtros.status === 'pendente' ? 'Pendente' : 'Vencido'}`, remover: () => setFiltros(f => ({ ...f, status: 'todos' })) });
  if (filtros.origem !== 'todas') pilulas.push({ chave: 'origem', texto: filtros.origem === 'os' ? 'Ordem de serviço' : 'Lançamento manual', remover: () => setFiltros(f => ({ ...f, origem: 'todas' })) });
  if (filtros.categorias.length) {
    const nomes = filtros.categorias.map(c => { const [tipo, cat] = c.split(':'); return labelCategoria(tipo as 'entrada' | 'saida', cat); });
    pilulas.push({ chave: 'categorias', texto: `Categoria: ${nomes.join(', ')}`, remover: () => setFiltros(f => ({ ...f, categorias: [] })) });
  }
  if (filtros.formas.length) pilulas.push({ chave: 'formas', texto: `Pagamento: ${filtros.formas.map(x => LABEL_FORMA_PAGAMENTO[x] ?? x).join(', ')}`, remover: () => setFiltros(f => ({ ...f, formas: [] })) });
  if (filtros.de || filtros.ate) {
    const texto = filtros.de && filtros.ate ? `${diaMes(filtros.de)} a ${diaMes(filtros.ate)}` : filtros.de ? `a partir de ${dataCompleta(filtros.de)}` : `até ${dataCompleta(filtros.ate)}`;
    pilulas.push({ chave: 'data', texto: `Data: ${texto}`, remover: () => setFiltros(f => ({ ...f, de: '', ate: '' })) });
  }
  if (filtros.valorMin || filtros.valorMax) {
    const min = filtros.valorMin ? formatBRL(Number(filtros.valorMin)) : '';
    const max = filtros.valorMax ? formatBRL(Number(filtros.valorMax)) : '';
    pilulas.push({ chave: 'valor', texto: `Valor: ${min && max ? `${min} a ${max}` : min ? `a partir de ${min}` : `até ${max}`}`, remover: () => setFiltros(f => ({ ...f, valorMin: '', valorMax: '' })) });
  }

  // ── Ações de um lançamento (deslize e folha usam as mesmas regras) ─────────
  const acoesDe = (t: Transacao): AcaoLinha[] => {
    if (!p.podeEditar) return [];
    const lista: AcaoLinha[] = [];
    if (t.status === 'pendente') {
      lista.push({ id: 'pagar', rotulo: t.tipo === 'entrada' ? 'Receber' : 'Pagar', icone: IcConfirmar, ok: true, executar: () => p.onMarcarPago(t.id) });
    }
    lista.push({ id: 'editar', rotulo: 'Editar', icone: IcEditar, executar: () => p.onEditar(t) });
    if (t.status !== 'cancelado') {
      lista.push({ id: 'cancelar', rotulo: 'Cancelar', icone: IcLixeira, perigo: true, executar: () => p.onCancelar(t) });
    }
    return lista;
  };

  // ── Deslizar para revelar as ações (mesmo padrão de Clientes/Ordens) ──────
  const aoPressionar = (e: ReactPointerEvent<HTMLDivElement>, t: Transacao) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const largura = acoesDe(t).length * LARGURA_ACAO;
    if (largura === 0) return;
    gesto.current = {
      id: t.id, x0: e.clientX, y0: e.clientY, base: aberto === t.id ? -largura : 0, largura, horizontal: null, moveu: false,
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
    setArrasto({ id: g.id, x: Math.max(-g.largura - 24, Math.min(0, g.base + dx)) });
  };

  const aoSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (g?.horizontal && g.moveu) {
      const x = arrasto?.id === g.id ? arrasto.x : g.base;
      setAberto(x < -g.largura / 2 ? g.id : null);
      suprimirClique.current = true;
      window.setTimeout(() => { suprimirClique.current = false; }, 60);
    }
    setArrasto(null);
  };

  const aoTocar = (t: Transacao) => {
    if (suprimirClique.current) return;
    if (aberto) { setAberto(null); return; }
    setItemSheet(t);
  };

  const fecharSheetE = (acao: () => void) => () => { setItemSheet(null); acao(); };

  const limparLancamentos = () => { setFiltros(FILTROS_VAZIOS); setBusca(''); };

  // ── Peças da tela ─────────────────────────────────────────────────────────
  const periodoPersonalizado = p.periodo.id === 'personalizado';
  const subtitulo = !resumo && !p.erro
    ? 'Carregando…'
    : `${descreverPeriodo(p.periodo)}${resumo ? ` · ${p.transacoes.length} ${p.transacoes.length === 1 ? 'lançamento' : 'lançamentos'}` : ''}`;

  const abas: { id: Aba; rotulo: string; qtd?: number; alerta?: boolean }[] = [
    { id: 'lancamentos', rotulo: 'Lançamentos', qtd: p.transacoes.length },
    { id: 'contas', rotulo: 'Contas', qtd: pendentesTotal, alerta: vencidasTotal > 0 },
    { id: 'graficos', rotulo: 'Gráficos' },
  ];

  const chipsConta: { id: FiltroConta; rotulo: string; qtd: number }[] = [
    { id: 'todas', rotulo: 'Todas', qtd: contasOrdenadas.length },
    { id: 'vencidas', rotulo: 'Vencidas', qtd: contasVencidas.length },
    { id: 'a-vencer', rotulo: 'A vencer', qtd: contasAVencer.length },
  ];

  const cartaoTipoConta = (tipo: TipoContas, itens: Transacao[]) => {
    const vencidos = itens.filter(t => t.vencido);
    return (
      <button
        key={tipo}
        type="button"
        className="finm-contas-tipo"
        aria-pressed={contasTipo === tipo}
        onClick={() => { setContasTipo(tipo); setContasFiltro('todas'); }}
      >
        <span className="finm-contas-tipo__rotulo">{tipo === 'receber' ? 'A receber' : 'A pagar'}</span>
        <span className="finm-contas-tipo__valor"><Valor texto={formatBRL(somaValores(itens))} /></span>
        <span className={`finm-contas-tipo__ctx${vencidos.length ? ' finm-contas-tipo__ctx--alerta' : ''}`}>
          {itens.length === 0
            ? 'Nada pendente'
            : vencidos.length > 0
              ? <><Valor texto={formatBRL(somaValores(vencidos))} /> vencido</>
              : `${itens.length} pendente${itens.length > 1 ? 's' : ''}`}
        </span>
      </button>
    );
  };

  const restantesContas = contasVisiveis.length - Math.min(contasLimite, contasVisiveis.length);

  return (
    <div className="finm-page">
      {/* Topo */}
      <header className="finm-topo">
        <div className="finm-barra">
          <div className="finm-barra__titulos">
            <h1 className="finm-titulo">Financeiro</h1>
            <p className="finm-subtitulo">{subtitulo}</p>
          </div>
          <BotaoPrivacidade variante="mobile" />
          {p.podeEditar && (
            <button type="button" className="finm-acao" onClick={p.onNovo} aria-label="Novo lançamento">
              {IcMais}
            </button>
          )}
        </div>

        <div className="finm-periodos" role="group" aria-label="Período">
          {ATALHOS_PERIODO.map(id => (
            <button
              key={id}
              type="button"
              className="finm-chip"
              aria-pressed={p.periodo.id === id}
              onClick={() => p.onPeriodo({ id })}
            >
              {ROTULO_PERIODO[id]}
            </button>
          ))}
          <button
            type="button"
            className="finm-chip"
            aria-pressed={periodoPersonalizado}
            aria-haspopup="dialog"
            onClick={() => setModalPeriodo(true)}
          >
            {IcCalendario}
            {periodoPersonalizado ? intervaloCurto(p.de, p.ate) : 'Personalizado'}
          </button>
        </div>
      </header>

      {p.erro && (
        <div className="finm-aviso os-status--recusada" role="alert">
          <span>{p.erro}</span>
          <button type="button" className="finm-aviso__btn" onClick={p.onRecarregar}>Tentar de novo</button>
        </div>
      )}

      {!resumo ? (
        !p.erro && (
          <div className="finm-carregando" role="status" aria-label="Carregando o financeiro">
            <Skeleton h={96} r={8} />
            <div className="finm-carregando__grade"><Skeleton h={84} r={8} /><Skeleton h={84} r={8} /></div>
            <Skeleton h={44} r={6} />
            <Skeleton h={72} r={6} />
            <Skeleton h={72} r={6} />
          </div>
        )
      ) : (
        <div className={`finm-conteudo${p.carregando ? ' finm-conteudo--carregando' : ''}`} aria-busy={p.carregando}>
          {/* Indicadores: Faturamento em destaque; o resto em grade de 2 colunas */}
          <section className="finm-kpis" aria-label="Resumo do período">
            <Kpi
              id="fin-kpi-faturamento" rotulo="Faturamento" valor={resumo.faturamento} destaque
              contexto={resumo.taxas && resumo.taxas > 0 ? <><Valor texto={formatBRL(resumo.taxas)} /> em taxas de maquininha</> : undefined}
            />
            <Kpi id="fin-kpi-despesas" rotulo="Despesas" valor={resumo.despesas} />
            {p.podeVerMargem && resumo.lucro !== undefined && (
              <Kpi
                id="fin-kpi-lucro" rotulo="Lucro" valor={resumo.lucro} negativo={lucroNegativo}
                contexto={<><Valor texto={`${resumo.margem_percentual}%`} mascara="••%" /> de margem</>}
              />
            )}
            <Kpi rotulo="Saldo" valor={resumo.saldo} negativo={resumo.saldo < 0 && !oculto} contexto="Recebido − despesas pagas" />
            <Kpi
              rotulo="A receber" valor={resumo.a_receber}
              alerta={resumo.vencido_receber > 0}
              contexto={resumo.vencido_receber > 0 ? <><Valor texto={formatBRL(resumo.vencido_receber)} /> vencido</> : 'Nada vencido'}
            />
          </section>

          {temReserva && p.reserva && (
            <ReservaMobile
              reserva={p.reserva} erro={p.erroReserva} podeRetirar={p.podeRetirarReserva}
              onRetirar={p.onRetirarReserva} onDesfazer={p.onDesfazerRetirada}
            />
          )}

          {/* Seções */}
          <div className="finm-abas" role="tablist" aria-label="Seções do Financeiro">
            {abas.map(a => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`finm-aba-${a.id}`}
                aria-selected={aba === a.id}
                aria-controls={`finm-painel-${a.id}`}
                className="finm-aba"
                onClick={() => setAba(a.id)}
              >
                {a.rotulo}
                {a.qtd !== undefined && <span className={`finm-aba__qtd${a.alerta ? ' finm-aba__qtd--alerta' : ''}`}>{a.qtd}</span>}
              </button>
            ))}
          </div>

          {/* ── Lançamentos ─────────────────────────────────────────────── */}
          {aba === 'lancamentos' && (
            <div role="tabpanel" id="finm-painel-lancamentos" aria-labelledby="finm-aba-lancamentos">
              <div className="finm-busca-linha">
                <label className="finm-busca">
                  {IcBuscar}
                  <input
                    name="busca_lancamentos_mobile"
                    type="search"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar descrição ou cliente"
                    aria-label="Buscar lançamentos por descrição, cliente ou categoria"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                </label>
                <button type="button" className="finm-filtros-btn" aria-haspopup="dialog" onClick={() => setModalFiltros(true)}>
                  {IcFiltros}
                  Filtros
                  {nFiltros > 0 && <span className="finm-filtros-btn__contador">{nFiltros}</span>}
                </button>
              </div>

              {pilulas.length > 0 && (
                <div className="finm-filtros" role="group" aria-label="Filtros ligados">
                  {pilulas.map(x => (
                    <button key={x.chave} type="button" className="finm-pilula" onClick={x.remover} aria-label={`Remover filtro ${x.texto}`}>
                      {x.texto}
                      {IcFechar}
                    </button>
                  ))}
                  <button type="button" className="finm-pilula finm-pilula--limpar" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar tudo</button>
                </div>
              )}

              <div className="finm-lista-cab">
                <span className="finm-lista-cab__texto">
                  {filtrados.length === p.transacoes.length
                    ? `${p.transacoes.length} ${p.transacoes.length === 1 ? 'lançamento' : 'lançamentos'}`
                    : `${filtrados.length} de ${p.transacoes.length} lançamentos`}
                </span>
                <button
                  type="button" className="finm-link-btn" onClick={exportar} disabled={filtrados.length === 0}
                  title="Baixa em CSV os lançamentos exibidos na lista"
                >
                  {IcExportar}
                  Exportar
                </button>
              </div>

              <section className="finm-lista" aria-label="Lançamentos do período">
                {visiveis.length === 0 ? (
                  <div className="finm-vazio">
                    <span className="finm-vazio__icone">{IcVazio}</span>
                    {p.transacoes.length === 0 ? (
                      <>
                        <strong>Nenhum lançamento nesse período</strong>
                        <span>Escolha outro período acima{p.podeEditar ? ' ou toque em + para criar um lançamento' : ''}.</span>
                      </>
                    ) : (
                      <>
                        <strong>Nenhum lançamento encontrado</strong>
                        <span>Ajuste a busca ou os filtros aplicados.</span>
                        <button type="button" className="finm-vazio__btn" onClick={limparLancamentos}>Limpar filtros</button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <ul className="finm-itens">
                      {visiveis.map(t => {
                        const acoes = acoesDe(t);
                        const largura = acoes.length * LARGURA_ACAO;
                        const mostraAcoes = largura > 0 && (aberto === t.id || arrasto?.id === t.id);
                        const x = arrasto?.id === t.id ? arrasto.x : aberto === t.id ? -largura : 0;
                        const entrada = t.tipo === 'entrada';
                        const detalhe = [t.cliente_nome, t.ordem_servico_id ? 'Ordem de serviço' : ''].filter(Boolean).join(' · ');

                        return (
                          <li key={t.id} className={`finm-item${aberto === t.id ? ' finm-item--aberta' : ''}`}>
                            {mostraAcoes && (
                              <div className="finm-acoes" style={{ width: largura }}>
                                {acoes.map(a => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    className={`finm-acoes__btn${a.perigo ? ' finm-acoes__btn--perigo' : ''}${a.ok ? ' finm-acoes__btn--ok' : ''}`}
                                    onClick={() => { setAberto(null); a.executar(); }}
                                  >
                                    {a.icone}
                                    {a.rotulo}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div
                              className="finm-cartao"
                              role="button"
                              tabIndex={0}
                              aria-label={`Ver lançamento ${nomeDoLancamento(t)}`}
                              style={{ transform: `translateX(${x}px)`, transition: arrasto?.id === t.id ? 'none' : undefined }}
                              onPointerDown={e => aoPressionar(e, t)}
                              onPointerMove={aoMover}
                              onPointerUp={aoSoltar}
                              onPointerCancel={aoSoltar}
                              onClick={() => aoTocar(t)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  aoTocar(t);
                                }
                              }}
                            >
                              <div className="finm-linha1">
                                <span className={`os-status ${classeStatus(t)}`.trim()}>
                                  <span className="os-status__dot" aria-hidden="true" />
                                  {rotuloStatus(t)}
                                </span>
                                <span className="finm-meta-topo">{labelCategoria(t.tipo, t.categoria)} · {formatDataCurta(t.data_competencia)}</span>
                                <button
                                  type="button"
                                  className="finm-mais-btn"
                                  aria-label={`Mais detalhes de ${nomeDoLancamento(t)}`}
                                  aria-haspopup="dialog"
                                  onPointerDown={e => e.stopPropagation()}
                                  onClick={e => { e.stopPropagation(); setAberto(null); setItemSheet(t); }}
                                >
                                  {IcReticencias}
                                </button>
                              </div>

                              <div className="finm-linha2">
                                <span className={`finm-tipo finm-tipo--${t.tipo}`} aria-hidden="true">{entrada ? IcReceber : IcPagar}</span>
                                <div className="finm-info">
                                  <span className="finm-info__nome">{nomeDoLancamento(t)}</span>
                                  <span className="finm-info__detalhe">{detalhe || (entrada ? 'Entrada' : 'Saída')}</span>
                                </div>
                                <div className={`finm-valor${entrada ? ' finm-valor--entrada' : ''}`}>
                                  <span>{entrada ? '+ ' : '- '}<Valor texto={formatBRL(t.valor)} /></span>
                                  {entrada && t.taxa > 0 && <span className="finm-valor__liquido">líquido <Valor texto={formatBRL(t.valor_liquido)} /></span>}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {restantes > 0 && (
                      <button type="button" className="finm-mais-pag" onClick={() => setLimite(l => l + POR_PAGINA)}>
                        Mostrar mais {Math.min(restantes, POR_PAGINA)}
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          {/* ── Contas a receber / a pagar ──────────────────────────────── */}
          {aba === 'contas' && (
            <div role="tabpanel" id="finm-painel-contas" aria-labelledby="finm-aba-contas">
              <div className="finm-contas-tipos" role="group" aria-label="Tipo de conta">
                {cartaoTipoConta('receber', p.pendentesReceber)}
                {cartaoTipoConta('pagar', p.pendentesPagar)}
              </div>

              <div className="finm-busca-linha">
                <label className="finm-busca">
                  {IcBuscar}
                  <input
                    name="busca_contas_mobile"
                    type="search"
                    value={contasBusca}
                    onChange={e => setContasBusca(e.target.value)}
                    placeholder="Buscar descrição, categoria ou cliente"
                    aria-label="Buscar contas por descrição, categoria ou cliente"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                </label>
              </div>

              <div className="finm-filtros" role="group" aria-label="Filtrar contas">
                {chipsConta.map(c => (
                  <button key={c.id} type="button" className="finm-chip" aria-pressed={contasFiltro === c.id} onClick={() => setContasFiltro(c.id)}>
                    {c.rotulo}
                    <span className="finm-chip__qtd">{c.qtd}</span>
                  </button>
                ))}
              </div>

              <section className="finm-lista" aria-label={contasTipo === 'receber' ? 'Contas a receber' : 'Contas a pagar'}>
                {contasVisiveis.length === 0 ? (
                  <div className="finm-vazio">
                    <strong>
                      {contasOrdenadas.length === 0
                        ? (contasTipo === 'receber' ? 'Nenhuma conta a receber' : 'Nenhuma conta a pagar')
                        : 'Nenhuma conta encontrada'}
                    </strong>
                    <span>
                      {contasOrdenadas.length === 0
                        ? 'Nada pendente por aqui, sem limite de período.'
                        : 'Ajuste a busca ou o filtro aplicado.'}
                    </span>
                    {contasOrdenadas.length > 0 && (
                      <button type="button" className="finm-vazio__btn" onClick={() => { setContasFiltro('todas'); setContasBusca(''); }}>Limpar filtros</button>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="finm-lista-nota">
                      {contasTipo === 'receber' ? 'Tudo que clientes ainda vão pagar' : 'Tudo que a oficina ainda vai pagar'}, por urgência.
                    </p>
                    <ul className="finm-itens">
                      {contasVisiveis.slice(0, contasLimite).map(t => (
                        <li key={t.id} className="finm-conta">
                          <button type="button" className="finm-conta__corpo" onClick={() => setItemSheet(t)} aria-label={`Ver conta ${nomeDoLancamento(t)}`}>
                            <span className="finm-conta__nome">{nomeDoLancamento(t)}{t.cliente_nome ? ` — ${t.cliente_nome}` : ''}</span>
                            <span className={`finm-conta__venc${t.vencido ? ' finm-conta__venc--vencida' : ''}`}>
                              {t.vencido ? 'Venceu em ' : t.data_vencimento ? 'Vence em ' : 'Competência '}{formatDataCurta(dataLimiteConta(t))}
                            </span>
                          </button>
                          <span className="finm-conta__valor"><Valor texto={formatBRL(t.valor)} /></span>
                          {p.podeEditar && (
                            <button
                              type="button"
                              className="finm-conta__btn"
                              onClick={() => p.onMarcarPago(t.id)}
                              aria-label={`${contasTipo === 'receber' ? 'Receber' : 'Pagar'}: ${nomeDoLancamento(t)}`}
                            >
                              {contasTipo === 'receber' ? IcReceber : IcPagar}
                              {contasTipo === 'receber' ? 'Receber' : 'Pagar'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {restantesContas > 0 && (
                      <button type="button" className="finm-mais-pag" onClick={() => setContasLimite(l => l + POR_PAGINA)}>
                        Mostrar mais {Math.min(restantesContas, POR_PAGINA)}
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          )}

          {/* ── Gráficos ────────────────────────────────────────────────── */}
          {aba === 'graficos' && (
            <div role="tabpanel" id="finm-painel-graficos" aria-labelledby="finm-aba-graficos" className="finm-graficos">
              <section className="finm-card" aria-labelledby="finm-fluxo-titulo">
                <div className="finm-card__cab">
                  <h3 id="finm-fluxo-titulo" className="finm-card__titulo">Fluxo de caixa</h3>
                  <p className="finm-card__sub">
                    Entradas líquidas e saídas por {fluxo.granularidade === 'dia' ? 'dia' : fluxo.granularidade === 'semana' ? 'semana' : 'mês'}
                  </p>
                </div>
                {p.transacoes.length === 0 ? (
                  <div className="finm-card__vazio">Sem lançamentos nesse período.</div>
                ) : (
                  <div className="finm-card__corpo"><FluxoCaixaBarras pontos={fluxo.pontos} compacto /></div>
                )}
              </section>

              <section className="finm-card" aria-labelledby="finm-desp-titulo">
                <div className="finm-card__cab">
                  <h3 id="finm-desp-titulo" className="finm-card__titulo">Despesas por categoria</h3>
                  <p className="finm-card__sub">Saídas do período, da maior para a menor</p>
                </div>
                {despesas.total === 0 ? (
                  <div className="finm-card__vazio">Sem despesas registradas nesse período.</div>
                ) : (
                  <div className="finm-card__corpo">
                    <div className="finm-rosca">
                      <GraficoPrivado selo={false} style={{ width: '100%', height: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={despesas.lista} dataKey="valor" nameKey="categoria" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none" animationDuration={600}>
                              {despesas.lista.map((_, i) => <Cell key={i} fill={PALETA_DONUT[i % PALETA_DONUT.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatBRL(v)} labelFormatter={(l) => labelCategoria('saida', String(l))} />
                          </PieChart>
                        </ResponsiveContainer>
                      </GraficoPrivado>
                      <div className="finm-rosca__total"><span>Total</span><strong><Valor texto={formatBRL(despesas.total)} /></strong></div>
                    </div>
                    <ul className="finm-despesas">
                      {despesas.lista.map((d, i) => (
                        <li key={d.categoria} className="finm-despesa">
                          <span className="finm-despesa__ponto" style={{ background: PALETA_DONUT[i % PALETA_DONUT.length] }} />
                          <span className="finm-despesa__nome">{labelCategoria('saida', d.categoria)}</span>
                          <span className="finm-despesa__pct">{oculto ? '••%' : `${Math.round((d.valor / despesas.total) * 100)}%`}</span>
                          <span className="finm-despesa__valor"><Valor texto={formatBRL(d.valor)} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {itemSheet && (
        <LancamentoSheet
          t={itemSheet}
          podeEditar={p.podeEditar}
          onFechar={() => setItemSheet(null)}
          onPagar={fecharSheetE(() => p.onMarcarPago(itemSheet.id))}
          onEditar={fecharSheetE(() => p.onEditar(itemSheet))}
          onCancelar={fecharSheetE(() => p.onCancelar(itemSheet))}
        />
      )}

      {modalPeriodo && (
        <PeriodoModal atual={p.periodo} onFechar={() => setModalPeriodo(false)} onAplicar={sel => { p.onPeriodo(sel); setModalPeriodo(false); }} />
      )}
      {modalFiltros && (
        <FiltrosLancamentosModal
          filtros={filtros} categorias={p.categorias} periodo={{ de: p.de, ate: p.ate }}
          onFechar={() => setModalFiltros(false)} onAplicar={f => { setFiltros(f); setModalFiltros(false); }}
        />
      )}
    </div>
  );
}

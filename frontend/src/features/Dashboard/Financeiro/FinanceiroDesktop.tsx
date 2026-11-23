import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Valor, GraficoPrivado } from '../../../components/Privacidade';
import { usePrivacidade } from '../../../context/PrivacidadeContext';
import { formatBRL } from '../../../utils/dashboard';
import {
  FILTROS_VAZIOS, contarFiltrosAtivos, descreverPeriodo, filtrarLancamentos, fluxoDeCaixa, lancamentosParaCsv,
  dataCompleta, diaMes,
} from '../../../utils/financeiro_utils';
import type { FiltrosLancamentos, PeriodoSel } from '../../../utils/financeiro_utils';
import { IcBuscar, IcFiltros, IcMais, IcEditar, IcLixeira, IcSetaEsq, IcSetaDir, IcFechar } from '../Estoque/icones';
import { IcExportar, IcCalendario, IcConfirmar, IcReceber, IcPagar, IcVazio } from './icones';
import { labelCategoria, LABEL_STATUS, LABEL_FORMA_PAGAMENTO, PALETA_DONUT } from './categoriaLabels';
import { LIMITE_WIDGET_CONTAS, ordenarPorUrgencia, dataLimiteConta, formatDataCurta, somaValores } from './contasUtils';
import { FluxoCaixaBarras } from './FluxoCaixaBarras';
import { ReservaDesktop } from './ReservaDesktop';
import { PeriodoModal } from './PeriodoModal';
import { FiltrosLancamentosModal } from './FiltrosLancamentosModal';
import type { ResumoFinanceiro } from './KpiCards';
import type { TipoContas } from './ContasWidget';
import type { Categorias, ReservaResumo, Transacao } from './types';
import '../Ordens/Status.css';
import './financeiroDesktop.css';

const POR_PAGINA = 20;

export interface FinanceiroDesktopProps {
  periodo: PeriodoSel;
  de: string;
  ate: string;
  onPeriodo: (sel: PeriodoSel) => void;
  resumo: ResumoFinanceiro | null;
  transacoes: Transacao[];
  pendentesReceber: Transacao[];
  pendentesPagar: Transacao[];
  categorias: Categorias;
  carregando: boolean;
  /** Erro de carga ou de ação (mensagem pronta). */
  erro: string | null;
  onRecarregar: () => void;
  reserva: ReservaResumo | null;
  erroReserva: string | null;
  podeEditar: boolean;
  podeVerMargem: boolean;
  podeRetirarReserva: boolean;
  onNovo: () => void;
  onEditar: (t: Transacao) => void;
  onMarcarPago: (id: string) => void;
  onCancelar: (t: Transacao) => void;
  onVerTodasContas: (tipo: TipoContas) => void;
  onRetirarReserva: (valor: number, descricao: string) => Promise<void>;
  onDesfazerRetirada: (id: string) => Promise<void>;
}

const nomeDoLancamento = (t: Transacao) => t.descricao || labelCategoria(t.tipo, t.categoria);
const rotuloStatus = (t: { status: string; vencido: boolean }) => (t.vencido ? 'Vencido' : LABEL_STATUS[t.status] ?? t.status);
const classeStatus = (t: Transacao) => (t.vencido ? 'os-status--recusada' : t.status === 'pago' ? 'os-status--finalizada' : 'os-status--pendente_aprovacao');

export function FinanceiroDesktop(p: FinanceiroDesktopProps) {
  const { oculto } = usePrivacidade();
  const [modalPeriodo, setModalPeriodo] = useState(false);
  const [modalFiltros, setModalFiltros] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosLancamentos>(FILTROS_VAZIOS);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  // Trocou o período: as datas do filtro (que valiam pro período antigo) saem e a tabela volta pra primeira página.
  useEffect(() => {
    setFiltros(f => (f.de || f.ate ? { ...f, de: '', ate: '' } : f));
    setPagina(1);
  }, [p.de, p.ate]);

  const filtrados = useMemo(
    () => filtrarLancamentos(p.transacoes, filtros, busca, labelCategoria),
    [p.transacoes, filtros, busca],
  );
  useEffect(() => { setPagina(1); }, [filtros, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const fluxo = useMemo(() => fluxoDeCaixa(p.transacoes, p.de, p.ate), [p.transacoes, p.de, p.ate]);

  const despesas = useMemo(() => {
    const porCat = new Map<string, number>();
    for (const t of p.transacoes) if (t.tipo === 'saida') porCat.set(t.categoria, (porCat.get(t.categoria) ?? 0) + t.valor);
    const lista = Array.from(porCat, ([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
    return { lista, total: lista.reduce((s, d) => s + d.valor, 0) };
  }, [p.transacoes]);

  const nFiltros = contarFiltrosAtivos(filtros);
  const resumo = p.resumo;
  const lucroNegativo = !!resumo && resumo.lucro !== undefined && resumo.lucro < 0 && !oculto;

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

  // Critérios ligados nos Filtros viram pílulas que se removem com um clique.
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

  const KpiBloco = ({ id, rotulo, valor, contexto, alerta, negativo }: { id?: string; rotulo: string; valor: number; contexto?: React.ReactNode; alerta?: boolean; negativo?: boolean }) => (
    <div className="fin-kpi" data-destaque-id={id}>
      <span className="fin-kpi__rotulo">{rotulo}</span>
      <span className={`fin-kpi__valor${negativo ? ' fin-kpi__valor--negativo' : ''}`}><Valor texto={formatBRL(valor)} /></span>
      {contexto && <span className={`fin-kpi__contexto${alerta ? ' fin-kpi__contexto--alerta' : ''}`}>{contexto}</span>}
    </div>
  );

  const Contas = ({ tipo, itens }: { tipo: TipoContas; itens: Transacao[] }) => {
    const ordenados = ordenarPorUrgencia(itens);
    const vencidos = itens.filter(t => t.vencido);
    const restantes = ordenados.length - LIMITE_WIDGET_CONTAS;
    const titulo = tipo === 'receber' ? 'Contas a receber' : 'Contas a pagar';
    return (
      <section className="fin-card fin-card--contas" aria-label={titulo}>
        <div className="fin-card__cab">
          <div className="fin-card__titulos">
            <h3 className="fin-card__titulo">{titulo}</h3>
            <p className={`fin-card__sub${vencidos.length ? ' fin-card__sub--alerta' : ''}`}>
              {itens.length === 0 ? 'Nada pendente' : (
                <>
                  {itens.length} pendente{itens.length > 1 ? 's' : ''} · <Valor texto={formatBRL(somaValores(itens))} />
                  {vencidos.length > 0 && <> · <Valor texto={formatBRL(somaValores(vencidos))} /> vencido</>}
                </>
              )}
            </p>
          </div>
          {restantes > 0 && (
            <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => p.onVerTodasContas(tipo)} aria-label={`Ver todas as ${ordenados.length} ${titulo.toLowerCase()}`}>
              Ver todas ({ordenados.length})
            </button>
          )}
        </div>
        {itens.length === 0 ? (
          <div className="fin-card__vazio">Nada pendente por aqui.</div>
        ) : (
          <ul className="fin-contas">
            {ordenados.slice(0, LIMITE_WIDGET_CONTAS).map(t => (
              <li key={t.id} className="fin-conta">
                <div className="fin-conta__texto">
                  <span className="fin-conta__nome">{nomeDoLancamento(t)}{t.cliente_nome ? ` — ${t.cliente_nome}` : ''}</span>
                  <span className={`fin-conta__venc${t.vencido ? ' fin-conta__venc--vencida' : ''}`}>
                    {t.vencido ? 'Venceu em ' : t.data_vencimento ? 'Vence em ' : 'Competência '}{formatDataCurta(dataLimiteConta(t))}
                  </span>
                </div>
                <span className="fin-conta__valor"><Valor texto={formatBRL(t.valor)} /></span>
                {p.podeEditar && (
                  <button type="button" className="fin-btn fin-btn--secundario fin-btn--sm" onClick={() => p.onMarcarPago(t.id)}
                    aria-label={`${tipo === 'receber' ? 'Receber' : 'Pagar'}: ${nomeDoLancamento(t)}`}>
                    {tipo === 'receber' ? IcReceber : IcPagar}{tipo === 'receber' ? 'Receber' : 'Pagar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  const temReserva = !!p.reserva && (p.reserva.ativa || p.reserva.movimentos.length > 0);
  const colunasLeitura = !p.podeEditar;

  return (
    <div className="fin-page">
      <header className="fin-header">
        <div className="fin-header__titulos">
          <h1 className="fin-titulo">Financeiro</h1>
          <p className="fin-subtitulo">
            <span>Entradas, saídas e fluxo de caixa da oficina</span>
            <span aria-hidden="true">·</span>
            <strong style={{ fontWeight: 500, color: 'var(--fin-texto)' }}>{descreverPeriodo(p.periodo)}</strong>
          </p>
        </div>
        <div className="fin-header__acoes">
          <button type="button" className="fin-btn fin-btn--secundario" onClick={() => setModalPeriodo(true)} aria-haspopup="dialog">
            {IcCalendario} Filtros
          </button>
          <button type="button" className="fin-btn fin-btn--secundario" onClick={exportar} disabled={filtrados.length === 0} title="Baixa em CSV os lançamentos exibidos na tabela">
            {IcExportar} Exportar
          </button>
          {p.podeEditar && (
            <button type="button" className="fin-btn fin-btn--primario" onClick={p.onNovo}>{IcMais} Novo lançamento</button>
          )}
        </div>
      </header>

      {p.erro && (
        <div className="fin-aviso os-status--recusada" role="alert">
          <p>{p.erro}</p>
          <button type="button" className="fin-btn fin-btn--secundario fin-btn--sm" onClick={p.onRecarregar}>Tentar de novo</button>
        </div>
      )}

      {!resumo ? (
        !p.erro && <div className="fin-vazio" role="status">Carregando…</div>
      ) : (
        <div className={`fin-conteudo${p.carregando ? ' fin-conteudo--carregando' : ''}`} aria-busy={p.carregando}>
          <div className="fin-kpis">
            <KpiBloco
              id="fin-kpi-faturamento" rotulo="Faturamento" valor={resumo.faturamento}
              contexto={resumo.taxas && resumo.taxas > 0 ? <><Valor texto={formatBRL(resumo.taxas)} /> em taxas de maquininha</> : undefined}
            />
            <KpiBloco id="fin-kpi-despesas" rotulo="Despesas" valor={resumo.despesas} />
            {p.podeVerMargem && resumo.lucro !== undefined && (
              <KpiBloco
                id="fin-kpi-lucro" rotulo="Lucro" valor={resumo.lucro} negativo={lucroNegativo}
                contexto={<><Valor texto={`${resumo.margem_percentual}%`} mascara="••%" /> de margem</>}
              />
            )}
            <KpiBloco rotulo="Saldo" valor={resumo.saldo} negativo={resumo.saldo < 0 && !oculto} contexto="Recebido − despesas pagas" />
            <KpiBloco
              rotulo="A receber" valor={resumo.a_receber}
              alerta={resumo.vencido_receber > 0}
              contexto={resumo.vencido_receber > 0 ? <><Valor texto={formatBRL(resumo.vencido_receber)} /> vencido</> : 'Nada vencido'}
            />
          </div>

          <div className={`fin-fileira${temReserva ? ' fin-fileira--com-lateral' : ''}`}>
            <section className="fin-card" aria-labelledby="fin-fluxo-titulo">
              <div className="fin-card__cab">
                <div className="fin-card__titulos">
                  <h3 id="fin-fluxo-titulo" className="fin-card__titulo">Fluxo de caixa</h3>
                  <p className="fin-card__sub">
                    Entradas líquidas e saídas por {fluxo.granularidade === 'dia' ? 'dia' : fluxo.granularidade === 'semana' ? 'semana' : 'mês'}
                  </p>
                </div>
              </div>
              {p.transacoes.length === 0 ? (
                <div className="fin-card__vazio">Sem lançamentos nesse período.</div>
              ) : (
                <div className="fin-card__corpo"><FluxoCaixaBarras pontos={fluxo.pontos} /></div>
              )}
            </section>
            {temReserva && p.reserva && (
              <ReservaDesktop
                reserva={p.reserva} erro={p.erroReserva} podeRetirar={p.podeRetirarReserva}
                onRetirar={p.onRetirarReserva} onDesfazer={p.onDesfazerRetirada}
              />
            )}
          </div>

          <section className="fin-card" aria-labelledby="fin-desp-titulo">
            <div className="fin-card__cab">
              <div className="fin-card__titulos">
                <h3 id="fin-desp-titulo" className="fin-card__titulo">Despesas por categoria</h3>
                <p className="fin-card__sub">Saídas do período, da maior para a menor</p>
              </div>
            </div>
            {despesas.total === 0 ? (
              <div className="fin-card__vazio">Sem despesas registradas nesse período.</div>
            ) : (
              <div className="fin-card__corpo">
                <div className="fin-despesas">
                  <div className="fin-despesas__rosca">
                    <GraficoPrivado selo={false} style={{ width: '100%', height: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={despesas.lista} dataKey="valor" nameKey="categoria" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" animationDuration={600}>
                            {despesas.lista.map((_, i) => <Cell key={i} fill={PALETA_DONUT[i % PALETA_DONUT.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatBRL(v)} labelFormatter={(l) => labelCategoria('saida', String(l))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </GraficoPrivado>
                    <div className="fin-despesas__total"><span>Total</span><strong><Valor texto={formatBRL(despesas.total)} /></strong></div>
                  </div>
                  <ul className="fin-despesas__lista">
                    {despesas.lista.map((d, i) => (
                      <li key={d.categoria} className="fin-despesas__item">
                        <span className="fin-despesas__ponto" style={{ background: PALETA_DONUT[i % PALETA_DONUT.length] }} />
                        <span className="fin-despesas__nome">{labelCategoria('saida', d.categoria)}</span>
                        <span className="fin-despesas__pct">{oculto ? '••%' : `${Math.round((d.valor / despesas.total) * 100)}%`}</span>
                        <span className="fin-despesas__valor"><Valor texto={formatBRL(d.valor)} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <div className="fin-fileira fin-fileira--dupla">
            <Contas tipo="receber" itens={p.pendentesReceber} />
            <Contas tipo="pagar" itens={p.pendentesPagar} />
          </div>

          <section className="fin-card fin-lancamentos" aria-labelledby="fin-lanc-titulo">
            <div className="fin-barra">
              <div className="fin-barra__titulos">
                <h3 id="fin-lanc-titulo" className="fin-card__titulo">Lançamentos do período</h3>
                <p className="fin-card__sub">
                  {filtrados.length === p.transacoes.length
                    ? `${p.transacoes.length} lançamento${p.transacoes.length === 1 ? '' : 's'}`
                    : `${filtrados.length} de ${p.transacoes.length} lançamentos`}
                </p>
              </div>
              <label className="fin-busca">
                {IcBuscar}
                <span className="fin-sr">Buscar lançamentos</span>
                <input type="search" placeholder="Buscar por descrição ou cliente" value={busca} onChange={e => setBusca(e.target.value)} />
              </label>
              <button type="button" className="fin-btn fin-btn--secundario" onClick={() => setModalFiltros(true)} aria-haspopup="dialog">
                {IcFiltros} Filtros {nFiltros > 0 && <span className="fin-btn__contador">{nFiltros}</span>}
              </button>
              {pilulas.length > 0 && (
                <div className="fin-barra__chips">
                  {pilulas.map(x => (
                    <button key={x.chave} type="button" className="fin-pilula" onClick={x.remover} aria-label={`Remover filtro ${x.texto}`}>
                      {x.texto}{IcFechar}
                    </button>
                  ))}
                  <button type="button" className="fin-btn fin-btn--ghost fin-btn--sm" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar tudo</button>
                </div>
              )}
            </div>

            {filtrados.length === 0 ? (
              <div className="fin-vazio">
                <span className="fin-vazio__icone">{IcVazio}</span>
                {p.transacoes.length === 0 ? (
                  <><strong>Nenhum lançamento nesse período</strong><span>Escolha outro período em Filtros ou crie um novo lançamento.</span></>
                ) : (
                  <>
                    <strong>Nenhum lançamento com esses filtros</strong>
                    <span>Tente remover algum critério ou mudar a busca.</span>
                    <button type="button" className="fin-btn fin-btn--secundario fin-btn--sm" style={{ marginTop: 12 }} onClick={() => { setFiltros(FILTROS_VAZIOS); setBusca(''); }}>Limpar filtros</button>
                  </>
                )}
              </div>
            ) : (
              <div className="fin-tabela-rolagem">
                <div className={`fin-tabela${colunasLeitura ? ' fin-tabela--leitura' : ''}`} role="table" aria-label="Lançamentos do período">
                  <div className="fin-thead" role="row">
                    <span role="columnheader">Descrição</span>
                    <span role="columnheader">Categoria</span>
                    <span role="columnheader">Data</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader" className="fin-num">Valor</span>
                    {p.podeEditar && <span role="columnheader"><span className="fin-sr">Ações</span></span>}
                  </div>
                  {visiveis.map(t => (
                    <div key={t.id} className="fin-linha" role="row">
                      <div className="fin-cel fin-cel--descricao" role="cell">
                        <span className="fin-cel__principal">{nomeDoLancamento(t)}</span>
                        {(t.cliente_nome || t.ordem_servico_id) && (
                          <span className="fin-cel__secundaria">{[t.cliente_nome, t.ordem_servico_id ? 'Ordem de serviço' : ''].filter(Boolean).join(' · ')}</span>
                        )}
                      </div>
                      <div className="fin-cel fin-cel--categoria" role="cell">{labelCategoria(t.tipo, t.categoria)}</div>
                      <div className="fin-cel" role="cell">{formatDataCurta(t.data_competencia)}</div>
                      <div className="fin-cel" role="cell">
                        <span className={`fin-selo ${classeStatus(t)}`}><span className="fin-selo__ponto" />{rotuloStatus(t)}</span>
                      </div>
                      <div className={`fin-cel fin-cel--valor${t.tipo === 'entrada' ? ' fin-cel--entrada' : ''}`} role="cell">
                        <span>{t.tipo === 'entrada' ? '+ ' : '- '}<Valor texto={formatBRL(t.valor)} /></span>
                        {t.tipo === 'entrada' && t.taxa > 0 && <span className="fin-cel__liquido">líquido <Valor texto={formatBRL(t.valor_liquido)} /></span>}
                      </div>
                      {p.podeEditar && (
                        <div className="fin-cel fin-cel--acoes" role="cell">
                          {t.status === 'pendente' && (
                            <button type="button" className="fin-acao fin-acao--ok" onClick={() => p.onMarcarPago(t.id)} aria-label="Marcar como pago" title="Marcar como pago">{IcConfirmar}</button>
                          )}
                          <button type="button" className="fin-acao" onClick={() => p.onEditar(t)} aria-label="Editar lançamento" title="Editar">{IcEditar}</button>
                          <button type="button" className="fin-acao fin-acao--perigo" onClick={() => p.onCancelar(t)} aria-label="Cancelar lançamento" title="Cancelar">{IcLixeira}</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalPaginas > 1 && (
              <div className="fin-paginacao">
                <span className="fin-paginacao__resumo">
                  {(paginaAtual - 1) * POR_PAGINA + 1}–{Math.min(paginaAtual * POR_PAGINA, filtrados.length)} de {filtrados.length}
                </span>
                <button type="button" className="fin-btn fin-btn--secundario fin-btn--sm" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} aria-label="Página anterior">{IcSetaEsq}</button>
                <button type="button" className="fin-btn fin-btn--secundario fin-btn--sm" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} aria-label="Próxima página">{IcSetaDir}</button>
              </div>
            )}
          </section>
        </div>
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

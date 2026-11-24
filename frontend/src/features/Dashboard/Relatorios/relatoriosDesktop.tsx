import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { usePrivacidade } from '../../../context/PrivacidadeContext';
import { GraficoPrivado, MASCARA_PERCENTUAL, Valor } from '../../../components/Privacidade';
import { ALVO } from '../../../utils/destaque';
import { formatBRL } from '../../../utils/dashboard';
import { formatarNumero } from '../../../utils/relatorios';
import type {
  FaturamentoOrigem,
  FiltroPeriodo,
  IntervaloDatas,
  KpisRelatorio,
  MediaDiaria,
  PontoSerieTemporal,
  ServicoRealizado,
} from '../../../types/relatorios';
import type { ItemEstoqueMovimentado } from '../../../types/estoque';
import { RelatoriosHeader } from './relatoriosHeader';
import { FaturamentoGraficoDesktop, OrdensGraficoDesktop } from './relatoriosGraficos';
import { DestaquesPeriodo } from './destaquesPeriodo';
import { IcCaixa, IcChave, IcVazio } from './relatoriosIcones';
import '../Ordens/Status.css';
import './relatoriosDesktop.css';

export interface RelatoriosDesktopProps {
  carregando: boolean;
  carregandoEstoque: boolean;
  erro: string | null;
  filtro: FiltroPeriodo;
  onFiltroChange: (filtro: FiltroPeriodo) => void;
  intervaloAtual: IntervaloDatas;
  kpis: KpisRelatorio;
  serieFaturamento: PontoSerieTemporal[];
  serieOrdens: PontoSerieTemporal[];
  servicosMaisRealizados: ServicoRealizado[];
  itensEstoqueMovimentados: ItemEstoqueMovimentado[];
  mediaDiaria: MediaDiaria | null;
  faturamentoOrigem: FaturamentoOrigem;
  temDadosNoPeriodo: boolean;
  onRecarregar: () => void;
  onGoToEstoque?: (focus: { search?: string }) => void;
}

function formatarMedia(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function Sparkline({ dados, oculto }: { dados: number[]; oculto: boolean }) {
  const serie = dados.map((valor, indice) => ({ indice, valor }));
  const maximo = Math.max(...dados, 1);

  return (
    <div
      className={`rel-kpi__spark${oculto ? ' privacidade-blur' : ''}`}
      aria-hidden={oculto || undefined}
    >
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={serie} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey='indice' hide />
          <YAxis hide domain={[0, maximo]} />
          <Area
            type='monotone'
            dataKey='valor'
            stroke='var(--rel-serie-atual)'
            strokeWidth={1.75}
            fill='var(--rel-serie-atual)'
            fillOpacity={0.12}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface KpiBlocoProps {
  id?: string;
  rotulo: string;
  valor: string;
  variacao: number | null;
  spark: number[];
  monetario?: boolean;
  oculto: boolean;
}

function KpiBloco({ id, rotulo, valor, variacao, spark, monetario = false, oculto }: KpiBlocoProps) {
  const mascarar = monetario && oculto;
  const positiva = variacao !== null && variacao >= 0;

  return (
    <div className='rel-kpi' data-destaque-id={id}>
      <span className='rel-kpi__rotulo'>{rotulo}</span>
      <div className='rel-kpi__corpo'>
        <div className='rel-kpi__dados'>
          <span className='rel-kpi__valor'>
            {monetario ? <Valor texto={valor} /> : valor}
          </span>
          <span className='rel-kpi__contexto'>
            {variacao === null ? (
              'Sem comparação no período anterior'
            ) : (
              <>
                <span
                  className={
                    mascarar
                      ? undefined
                      : positiva
                        ? 'rel-kpi__delta--ok'
                        : 'rel-kpi__delta--perigo'
                  }
                >
                  {monetario ? (
                    <Valor
                      texto={`${positiva ? '↑' : '↓'} ${Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                      mascara={MASCARA_PERCENTUAL}
                    />
                  ) : (
                    `${positiva ? '↑' : '↓'} ${Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                  )}
                </span>{' '}
                vs. período anterior
              </>
            )}
          </span>
        </div>
        <Sparkline dados={spark} oculto={mascarar} />
      </div>
    </div>
  );
}

export function RelatoriosDesktop({
  carregando,
  carregandoEstoque,
  erro,
  filtro,
  onFiltroChange,
  intervaloAtual,
  kpis,
  serieFaturamento,
  serieOrdens,
  servicosMaisRealizados,
  itensEstoqueMovimentados,
  mediaDiaria,
  faturamentoOrigem,
  temDadosNoPeriodo,
  onRecarregar,
  onGoToEstoque,
}: RelatoriosDesktopProps) {
  const { oculto } = usePrivacidade();

  const sparkFaturamento = serieFaturamento.map((p) => p.atual ?? 0);
  const sparkOrdens = serieOrdens.map((p) => p.atual ?? 0);
  const sparkTicket = serieFaturamento.map((p, i) => {
    const qtd = serieOrdens[i]?.atual ?? 0;
    return qtd > 0 ? (p.atual ?? 0) / qtd : 0;
  });

  const maiorServico = Math.max(...servicosMaisRealizados.map((s) => s.quantidade), 1);
  const maiorEstoque = Math.max(...itensEstoqueMovimentados.map((i) => i.quantidade), 1);
  const itensComId = itensEstoqueMovimentados.filter((i) => i.id);

  return (
    <div className='rel-page'>
      <RelatoriosHeader
        filtro={filtro}
        intervaloAtual={intervaloAtual}
        onChange={onFiltroChange}
      />

      {erro && !carregando && (
        <div className='rel-aviso os-status--recusada' role='alert'>
          <p>{erro}</p>
          <button
            type='button'
            className='rel-btn rel-btn--secundario rel-btn--sm'
            onClick={onRecarregar}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!erro && !carregando && !temDadosNoPeriodo && (
        <section className='rel-card'>
          <div className='rel-vazio'>
            <span className='rel-vazio__icone'>{IcVazio}</span>
            <strong>Nenhum dado neste período</strong>
            <span>
              Ainda não há dados suficientes para gerar relatórios no intervalo selecionado. Tente escolher um período maior.
            </span>
          </div>
        </section>
      )}

      {(carregando || (!erro && temDadosNoPeriodo)) && (
        <div className={`rel-conteudo${carregando ? ' rel-conteudo--carregando' : ''}`} aria-busy={carregando}>
          {/* KPIs */}
          {carregando ? (
            <div className='rel-kpis'>
              {Array.from({ length: mediaDiaria ? 4 : 3 }).map((_, i) => (
                <div key={i} className='rel-kpi'>
                  <div className='rel-esqueleto' style={{ width: 96, height: 14 }} />
                  <div className='rel-esqueleto' style={{ width: 148, height: 32 }} />
                  <div className='rel-esqueleto' style={{ width: 132, height: 14 }} />
                </div>
              ))}
            </div>
          ) : (
            <div className='rel-kpis'>
              <KpiBloco
                id={ALVO.relKpiFaturamento}
                rotulo='Faturamento'
                valor={formatBRL(kpis.faturamento.atual)}
                variacao={kpis.faturamento.variacaoPercentual}
                spark={sparkFaturamento}
                monetario
                oculto={oculto}
              />
              <KpiBloco
                id={ALVO.relKpiOs}
                rotulo='Ordens de serviço'
                valor={`${formatarNumero(kpis.ordensServico.atual)} OS`}
                variacao={kpis.ordensServico.variacaoPercentual}
                spark={sparkOrdens}
                oculto={oculto}
              />
              <KpiBloco
                rotulo='Ticket médio'
                valor={formatBRL(kpis.ticketMedio.atual)}
                variacao={kpis.ticketMedio.variacaoPercentual}
                spark={sparkTicket}
                monetario
                oculto={oculto}
              />
              {mediaDiaria && (
                <div className='rel-kpi'>
                  <span className='rel-kpi__rotulo'>Média diária de OS</span>
                  <span className='rel-kpi__valor'>{formatarMedia(mediaDiaria.atual.media)} OS/dia</span>
                  <span className='rel-kpi__contexto'>
                    {mediaDiaria.atual.rotulo}: {formatarNumero(mediaDiaria.atual.total)} OS
                    {mediaDiaria.anterior && (
                      <>
                        {' · '}
                        {mediaDiaria.anterior.rotulo}: {formatarMedia(mediaDiaria.anterior.media)} OS/dia ({formatarNumero(mediaDiaria.anterior.total)} OS)
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Gráficos comparativos (Recharts) */}
          <div className='rel-fileira rel-fileira--dupla'>
            <section className='rel-card' data-destaque-id={ALVO.relGraficoFaturamento}>
              <div className='rel-card__cab'>
                <div className='rel-card__titulos'>
                  <h2 className='rel-card__titulo'>Faturamento</h2>
                  <p className='rel-card__sub'>
                    {faturamentoOrigem === 'financeiro'
                      ? 'Entradas lançadas no Financeiro (exceto canceladas), por período, comparado ao período anterior.'
                      : 'Valor estimado das OS finalizadas (ainda sem entradas no Financeiro), por período, comparado ao período anterior.'}
                  </p>
                </div>
              </div>
              <div className='rel-card__corpo'>
                {carregando ? (
                  <div className='rel-esqueleto' style={{ width: '100%', height: 248 }} />
                ) : (
                  <GraficoPrivado>
                    <FaturamentoGraficoDesktop dados={serieFaturamento} height={224} />
                  </GraficoPrivado>
                )}
              </div>
            </section>

            <section className='rel-card' data-destaque-id={ALVO.relGraficoOs}>
              <div className='rel-card__cab'>
                <div className='rel-card__titulos'>
                  <h2 className='rel-card__titulo'>Ordens de serviço</h2>
                  <p className='rel-card__sub'>
                    Quantidade de OS abertas por período, comparado ao período anterior.
                  </p>
                </div>
              </div>
              <div className='rel-card__corpo'>
                {carregando ? (
                  <div className='rel-esqueleto' style={{ width: '100%', height: 248 }} />
                ) : (
                  <OrdensGraficoDesktop dados={serieOrdens} height={224} />
                )}
              </div>
            </section>
          </div>

          {/* Serviços mais realizados + Itens de estoque mais movimentados */}
          <div className='rel-fileira rel-fileira--dupla'>
            <section className='rel-card' data-destaque-id={ALVO.relServicosMaisRealizados}>
              <div className='rel-card__cab'>
                <div className='rel-card__titulos'>
                  <h2 className='rel-card__titulo'>Serviços mais realizados</h2>
                  <p className='rel-card__sub'>
                    Serviços mais frequentes entre as OS finalizadas no período (quantidade e % do total).
                  </p>
                </div>
                <span className='rel-card__icone' aria-hidden='true'>{IcChave}</span>
              </div>
              {carregando ? (
                <div className='rel-card__corpo'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className='rel-esqueleto' style={{ width: '100%', height: 26 }} />
                  ))}
                </div>
              ) : servicosMaisRealizados.length === 0 ? (
                <div className='rel-card__vazio'>
                  Nenhum serviço registrado em OS finalizadas neste período.
                </div>
              ) : (
                <div className='rel-card__corpo'>
                  <ul className='rel-lista-barras'>
                    {servicosMaisRealizados.map((s, i) => {
                      const pctLargura = Math.min(100, (s.quantidade / maiorServico) * 100);
                      return (
                        <li key={s.nome} className='rel-barra-item'>
                          <div className='rel-barra-item__topo'>
                            <span className='rel-barra-item__nome'>{s.nome}</span>
                            <span className='rel-barra-item__valor'>
                              {formatarNumero(s.quantidade)} OS · {s.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                            </span>
                          </div>
                          <div className='rel-barra' aria-hidden='true'>
                            <div
                              className={`rel-barra__fill${i === 0 ? ' rel-barra__fill--destaque' : ''}`}
                              style={{ width: `${pctLargura}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            <section className='rel-card'>
              <div className='rel-card__cab'>
                <div className='rel-card__titulos'>
                  <h2 className='rel-card__titulo'>Itens de estoque mais movimentados</h2>
                  <p className='rel-card__sub'>
                    Peças com mais saída de estoque no período (quantidade e % do total).
                  </p>
                </div>
                <span className='rel-card__icone' aria-hidden='true'>{IcCaixa}</span>
              </div>
              {carregando || carregandoEstoque ? (
                <div className='rel-card__corpo'>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className='rel-esqueleto' style={{ width: '100%', height: 26 }} />
                  ))}
                </div>
              ) : itensEstoqueMovimentados.length === 0 ? (
                <div className='rel-card__vazio'>
                  Nenhuma movimentação de estoque neste período.
                </div>
              ) : (
                <div className='rel-card__corpo'>
                  <ul className='rel-lista-barras'>
                    {itensEstoqueMovimentados.map((item, i) => {
                      const pctLargura = Math.min(100, (item.quantidade / maiorEstoque) * 100);
                      return (
                        <li key={item.nome} className='rel-barra-item'>
                          <div className='rel-barra-item__topo'>
                            <span className='rel-barra-item__nome'>{item.nome}</span>
                            <span className='rel-barra-item__valor'>
                              {formatarNumero(item.quantidade)} un. · {item.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                            </span>
                          </div>
                          <div className='rel-barra' aria-hidden='true'>
                            <div
                              className={`rel-barra__fill${i === 0 ? ' rel-barra__fill--destaque' : ''}`}
                              style={{ width: `${pctLargura}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          </div>

          {/* Destaques do período (estrutura original preservada, estética harmonizada + fallback de caixas do Estoque) */}
          {!carregando && !carregandoEstoque && itensComId.length > 0 && (
            <DestaquesPeriodo
              itens={itensComId}
              onVerItem={(nome) => onGoToEstoque?.({ search: nome })}
            />
          )}
        </div>
      )}
    </div>
  );
}
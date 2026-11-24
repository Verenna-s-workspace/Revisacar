import { useMemo, useState } from 'react';
import { Skeleton } from '../Primitives';
import { Placa } from '../Placa';
import { StatusOS } from '../Ordens/StatusOS';
import { veiculoDaOrdem } from '../Ordens/ordensUtils';
import { Valor, MASCARA_NUMERO } from '../../../components/Privacidade';
import { useAtendimento } from '../../../hooks/useAtendimento';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatBRL } from '../../../utils/dashboard';
import { calcularVariacao } from '../../../utils/relatorios';
import { toISODate } from '../../../utils/agenda';
import { DESTINOS_VISAO_GERAL } from '../../../utils/destaque';
import type { DestinoCard } from '../../../utils/destaque';
import type { AcaoAlerta } from '../../../utils/alertas';
import type { useAlertas } from '../../../hooks/useAlertas';
import type { NavPage, OrdemRow } from '../../../types/dashboard';
import type { VisaoGeral } from '../../../types/visao_geral';
import { IcAgendar, IcCheckGrande, IcMais, iconeDaFonte } from './icones';
import {
  FILTROS_PATIO, ROTULO_FILTRO_PATIO, agendaDeHoje, carrosNaOficina, contagemPatio, dataPorExtenso,
  detalheDoGrupo, linhaDoGrupo, linhasDoPatio, maisAntigoTexto, plural, totalAReceber, valorDaLinha,
} from './visaoGeralUtils';
import type { FiltroPatio } from './visaoGeralUtils';
import './visaoGeral.css';

/** Quantas OS cabem no cartão antes de mandar para o Atendimento (o resto está lá). */
const LIMITE_LINHAS = 8;
const LIMITE_AGENDA = 4;

interface Props {
  vg: VisaoGeral | null;
  vgLoading: boolean;
  vgErro: string | null;
  onRecarregarVg: () => void;
  onSalvarMeta: (valor: number | null) => Promise<void>;
  alertas: ReturnType<typeof useAlertas>;
  onNav: (p: NavPage) => void;
  onNewOS: () => void;
  onAgendar: () => void;
  onAbrirOS: (o: OrdemRow) => void;
  onAcaoAlerta: (acao: AcaoAlerta) => void;
  onIrParaDestino: (d: DestinoCard) => void;
}

function formatarMeta(meta: number): string {
  return meta.toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: Number.isInteger(meta) ? 0 : 2, maximumFractionDigits: 2,
  });
}

interface KpiProps {
  rotulo: string;
  valor: React.ReactNode;
  contexto: React.ReactNode;
  loading?: boolean;
  onAbrir?: () => void;
  ariaLabel?: string;
}

function Kpi({ rotulo, valor, contexto, loading, onAbrir, ariaLabel }: KpiProps) {
  const clicavel = !!onAbrir && !loading;
  return (
    <div
      className={`vg-kpi${clicavel ? ' vg-kpi--clicavel' : ''}`}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      aria-label={clicavel ? ariaLabel : undefined}
      onClick={clicavel ? onAbrir : undefined}
      onKeyDown={clicavel ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir?.(); } } : undefined}
    >
      <span className="vg-kpi__rotulo">{rotulo}</span>
      {loading ? <Skeleton h={32} w={90} r={6} /> : <span className="vg-kpi__valor">{valor}</span>}
      {loading ? <Skeleton h={14} w="70%" r={4} /> : <span className="vg-kpi__contexto">{contexto}</span>}
    </div>
  );
}

/** Faturamento do mês + meta (com edição no próprio cartão). Só existe para quem vê dinheiro. */
function KpiFaturamento({ vg, loading, onSalvarMeta, onAbrir }: {
  vg: VisaoGeral; loading: boolean; onSalvarMeta: Props['onSalvarMeta']; onAbrir: () => void;
}) {
  const fat = vg.faturamento!;
  const meta = vg.meta?.valor ?? null;
  const editavel = vg.meta?.editavel ?? false;
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abrirEdicao = () => { setTexto(meta !== null ? String(meta).replace('.', ',') : ''); setErro(null); setEditando(true); };
  const salvar = async (valor: number | null) => {
    setSalvando(true); setErro(null);
    try { await onSalvarMeta(valor); setEditando(false); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar a meta mensal.'); }
    finally { setSalvando(false); }
  };
  const confirmar = () => {
    const numero = Number(texto.trim().replace(/\./g, '').replace(',', '.'));
    if (texto.trim() === '' || !Number.isFinite(numero) || numero < 0) { setErro('Informe um valor válido (ex.: 20000 ou 20.000,00).'); return; }
    void salvar(numero);
  };

  if (editando) {
    return (
      <div className="vg-kpi vg-kpi--edicao">
        <label className="vg-kpi__rotulo" htmlFor="vg-meta-input">Meta de faturamento do mês (R$)</label>
        <input
          id="vg-meta-input" className="vg-kpi__input" autoFocus inputMode="decimal" value={texto} disabled={salvando}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false); }}
        />
        {erro && <span className="vg-kpi__erro">{erro}</span>}
        <span className="vg-kpi__acoes">
          <button type="button" className="vg-link" onClick={confirmar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" className="vg-link vg-link--mudo" onClick={() => setEditando(false)} disabled={salvando}>Cancelar</button>
          {meta !== null && <button type="button" className="vg-link vg-link--mudo" onClick={() => void salvar(null)} disabled={salvando}>Remover meta</button>}
        </span>
      </div>
    );
  }

  const variacao = calcularVariacao(fat.atual, fat.anterior);
  const botaoMeta = (rotulo: string) => (
    <button type="button" className="vg-link" onClick={e => { e.stopPropagation(); abrirEdicao(); }}>{rotulo}</button>
  );
  let contexto: React.ReactNode;
  if (meta !== null && meta > 0) {
    const pct = Math.round((fat.atual / meta) * 100);
    contexto = (
      <>
        <Valor texto={`${pct}%`} mascara="••%" /> da meta de <Valor texto={formatarMeta(meta)} mascara="R$ ••••" />
        {/* nowrap: o "·" quebra junto com o botão, nunca fica pendurado no fim da linha */}
        {editavel && <span style={{ whiteSpace: 'nowrap' }}> · {botaoMeta('Editar meta')}</span>}
      </>
    );
  } else if (editavel) {
    contexto = <>Sem meta definida · {botaoMeta('Definir meta')}</>;
  } else if (variacao !== null && variacao !== undefined) {
    contexto = <Valor texto={`${variacao >= 0 ? '+' : ''}${variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs. mês passado`} mascara="••%" />;
  } else {
    contexto = 'Mês corrente até hoje';
  }

  return (
    <Kpi
      rotulo="Faturamento do mês"
      valor={<Valor texto={formatBRL(fat.atual)} />}
      contexto={contexto}
      loading={loading}
      onAbrir={onAbrir}
      ariaLabel="Faturamento do mês — abrir o Financeiro"
    />
  );
}

export function VisaoGeralDesktop({
  vg, vgLoading, vgErro, onRecarregarVg, onSalvarMeta, alertas,
  onNav, onNewOS, onAgendar, onAbrirOS, onAcaoAlerta, onIrParaDestino,
}: Props) {
  const { can } = usePermissions();
  const verValor = can('financeiro.ver');
  const { ordens, agendamentos, colunas, clientesNaoAvisados, loading: atLoading, erro: atErro, reload } = useAtendimento();
  const [filtro, setFiltro] = useState<FiltroPatio>('todas');

  // Skeleton só na primeira carga (como no Atendimento).
  const carregando = atLoading && ordens.length === 0;

  const linhas = useMemo(() => linhasDoPatio(colunas), [colunas]);
  const contagem = useMemo(() => contagemPatio(linhas), [linhas]);
  const filtradas = useMemo(() => linhas.filter(l => filtro === 'todas' || l.grupo === filtro), [linhas, filtro]);
  const visiveis = filtradas.slice(0, LIMITE_LINHAS);

  const pendentesAprovacao = useMemo(() => ordens.filter(o => o.status === 'pendente_aprovacao'), [ordens]);
  const agenda = useMemo(() => agendaDeHoje(agendamentos, toISODate(new Date())), [agendamentos]);

  const naOficina = contagem.todas;
  const contextoOS = naOficina === 0
    ? 'Nenhuma OS em andamento'
    : `${contagem.em_execucao} em execução · ${contagem.bloqueado} aguardando peça`;
  const prontas = contagem.prontas;
  const contextoProntas = prontas === 0
    ? 'Nenhuma OS concluída hoje'
    : clientesNaoAvisados.length > 0
      ? `${plural(clientesNaoAvisados.length, 'cliente', 'clientes')} para avisar`
      : 'Todos os clientes avisados';

  const linhasAlerta = alertas.grupos.map(linhaDoGrupo);
  const colunasTabela = verValor ? 'vg-tabela--valor' : '';

  return (
    <div className="vg-page">
      {/* ── Cabeçalho ── */}
      <div className="vg-header">
        <div className="vg-header__titulos">
          <h1 className="vg-titulo">Hoje</h1>
          <p className="vg-subtitulo">
            {dataPorExtenso()}{!carregando && <> · {carrosNaOficina(naOficina)}</>}
          </p>
        </div>
        <button type="button" className="vg-btn vg-btn--secundario" onClick={onAgendar}>{IcAgendar}Agendar</button>
        <button type="button" className="vg-btn vg-btn--primario" onClick={onNewOS}>{IcMais}Nova OS</button>
      </div>

      {/* ── Erros (nunca zeros fictícios) ── */}
      {(vgErro || atErro) && (
        <div className="vg-erro" role="alert">
          <span>{atErro ?? vgErro}</span>
          <button type="button" className="vg-btn vg-btn--secundario vg-btn--sm" onClick={() => { if (atErro) reload(); if (vgErro) onRecarregarVg(); }}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="vg-kpis">
        <Kpi
          rotulo="Ordens de serviço" valor={naOficina} contexto={contextoOS} loading={carregando}
          onAbrir={() => onNav('atendimento')} ariaLabel="Ordens de serviço — abrir o Atendimento"
        />
        <Kpi
          rotulo="Aguardando aprovação" valor={pendentesAprovacao.length} contexto={maisAntigoTexto(pendentesAprovacao)} loading={carregando}
          onAbrir={() => onNav('ordens')} ariaLabel="Aguardando aprovação — abrir as Ordens de serviço"
        />
        <Kpi
          rotulo="Pronto para entregar" valor={prontas} contexto={contextoProntas} loading={carregando}
          onAbrir={() => onNav('atendimento')} ariaLabel="Pronto para entregar — abrir o Atendimento"
        />
        {(vgLoading || vg?.faturamento) && (
          vg?.faturamento
            ? <KpiFaturamento vg={vg} loading={vgLoading} onSalvarMeta={onSalvarMeta} onAbrir={() => onIrParaDestino(DESTINOS_VISAO_GERAL.faturamentoMes)} />
            : <Kpi rotulo="Faturamento do mês" valor="" contexto="" loading />
        )}
      </div>

      {/* ── Corpo ── */}
      <div className="vg-corpo">
        {/* Na oficina agora */}
        <section className="vg-card vg-patio" aria-label="Na oficina agora">
          <div className="vg-card__cab">
            <h2 className="vg-card__titulo">Na oficina agora</h2>
            <div className="vg-chips" role="group" aria-label="Filtrar por situação">
              {FILTROS_PATIO.map(f => (
                <button key={f} type="button" className="vg-chip" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                  {ROTULO_FILTRO_PATIO[f]} <span className="vg-chip__qtd">{contagem[f]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`vg-tabela ${colunasTabela}`} role="table" aria-label="Ordens de serviço na oficina">
            <div className="vg-tr vg-tr--cab" role="row">
              <span role="columnheader">Nº OS</span>
              <span role="columnheader">Cliente / veículo</span>
              <span role="columnheader">Placa</span>
              <span role="columnheader">Status</span>
              {verValor && <span role="columnheader" className="vg-direita">Valor</span>}
            </div>

            {carregando && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="vg-tr vg-tr--esq"><Skeleton h={22} r={4} /></div>
            ))}

            {!carregando && visiveis.map(({ ordem }) => {
              const valor = valorDaLinha(ordem);
              return (
                <div
                  key={ordem.id} className="vg-tr vg-tr--linha" role="row" tabIndex={0}
                  aria-label={`Abrir OS ${ordem.os_num} de ${ordem.cliente}`}
                  onClick={() => onAbrirOS(ordem)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrirOS(ordem); } }}
                >
                  <span role="cell" className="vg-mono">#{ordem.os_num}</span>
                  <span role="cell" className="vg-cliente">
                    <strong>{ordem.cliente || '—'}</strong>
                    <small>{veiculoDaOrdem(ordem)}</small>
                  </span>
                  <span role="cell"><Placa placa={ordem.placa} /></span>
                  <span role="cell"><StatusOS status={ordem.status} /></span>
                  {verValor && (
                    <span role="cell" className="vg-direita vg-valor">
                      {valor === null ? '—' : <Valor texto={formatBRL(valor)} mascara={`R$ ${MASCARA_NUMERO}`} />}
                    </span>
                  )}
                </div>
              );
            })}

            {!carregando && filtradas.length === 0 && (
              <div className="vg-vazio">
                {linhas.length === 0 ? 'Nenhum carro na oficina agora.' : 'Nenhuma OS nesta situação.'}
              </div>
            )}
          </div>

          {!carregando && filtradas.length > LIMITE_LINHAS && (
            <div className="vg-card__rodape">
              <button type="button" className="vg-link" onClick={() => onNav('atendimento')}>
                Ver mais {filtradas.length - LIMITE_LINHAS} no Atendimento
              </button>
            </div>
          )}
        </section>

        {/* Coluna direita */}
        <div className="vg-lateral">
          <section className="vg-card" aria-label="Agenda de hoje">
            <div className="vg-card__cab">
              <h2 className="vg-card__titulo">Agenda de hoje</h2>
              <button type="button" className="vg-link vg-link--topo" onClick={() => onNav('agendamentos')}>Abrir agenda</button>
            </div>
            <ul className="vg-lista">
              {carregando && Array.from({ length: 3 }).map((_, i) => <li key={i} className="vg-item"><Skeleton h={34} r={4} /></li>)}
              {!carregando && agenda.slice(0, LIMITE_AGENDA).map(a => (
                <li key={a.id} className="vg-item vg-item--agenda">
                  <span className="vg-mono vg-hora">{a.horaInicio}</span>
                  <span className="vg-item__textos">
                    <strong>{a.titulo || 'Agendamento'}</strong>
                    <small>{[a.cliente, a.veiculo, a.placa].filter(Boolean).join(' · ')}</small>
                  </span>
                </li>
              ))}
              {!carregando && agenda.length === 0 && <li className="vg-vazio">Nenhum agendamento para hoje.</li>}
              {!carregando && agenda.length > LIMITE_AGENDA && (
                <li className="vg-item vg-item--rodape">
                  <button type="button" className="vg-link" onClick={() => onNav('agendamentos')}>+{agenda.length - LIMITE_AGENDA} na agenda de hoje</button>
                </li>
              )}
            </ul>
          </section>

          <section className="vg-card" aria-label="Precisa de você">
            <div className="vg-card__cab">
              <h2 className="vg-card__titulo">Precisa de você</h2>
              <button type="button" className="vg-link vg-link--topo" onClick={() => onNav('alertas')}>Ver todos</button>
            </div>
            <ul className="vg-lista">
              {alertas.loading && Array.from({ length: 3 }).map((_, i) => <li key={i} className="vg-item"><Skeleton h={34} r={4} /></li>)}
              {!alertas.loading && alertas.erro && <li className="vg-vazio">{alertas.erro}</li>}
              {!alertas.loading && !alertas.erro && linhasAlerta.length === 0 && (
                <li className="vg-vazio vg-vazio--ok"><span aria-hidden="true">{IcCheckGrande}</span>Nenhum alerta no momento</li>
              )}
              {!alertas.loading && linhasAlerta.map(({ grupo, rotulo, acao }) => {
                const n = grupo.itens.length;
                const aReceber = totalAReceber(grupo, alertas.backend);
                return (
                  <li key={grupo.fonte.id} className="vg-item vg-item--alerta">
                    <span className={`vg-alerta__icone vg-alerta__icone--${grupo.severidade}`} aria-hidden="true">{iconeDaFonte(grupo.fonte.id)}</span>
                    <span className="vg-item__textos">
                      <strong>{grupo.fonte.resumo(n)}</strong>
                      <small>
                        {aReceber !== null
                          ? <Valor texto={`${formatBRL(aReceber)} a receber`} />
                          : detalheDoGrupo(grupo.itens)}
                      </small>
                    </span>
                    <button type="button" className="vg-link vg-link--acao" onClick={() => (acao ? onAcaoAlerta(acao) : onNav('alertas'))}>
                      {rotulo}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

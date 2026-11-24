import { useMemo } from 'react';
import { Skeleton } from '../Primitives';
import { Placa } from '../Placa';
import { StatusOS } from '../Ordens/StatusOS';
import { veiculoDaOrdem } from '../Ordens/ordensUtils';
import { BotaoPrivacidade, Valor, MASCARA_NUMERO } from '../../../components/Privacidade';
import { useAtendimento } from '../../../hooks/useAtendimento';
import { useNomeOficina } from '../../../hooks/UseNomeOficina';
import { usePermissions } from '../../../hooks/usePermissions';
import { formatBRL } from '../../../utils/dashboard';
import { DESTINOS_VISAO_GERAL } from '../../../utils/destaque';
import type { DestinoCard } from '../../../utils/destaque';
import type { AcaoAlerta } from '../../../utils/alertas';
import type { useAlertas } from '../../../hooks/useAlertas';
import type { NavPage, OrdemRow } from '../../../types/dashboard';
import type { VisaoGeral } from '../../../types/visao_geral';
import { iconeDaFonte, IcMais } from './icones';
import {
  carrosNaOficina, contagemPatio, detalheDoGrupo, linhaDoGrupo, linhasDoPatio,
  maisAntigoTexto, plural, totalAReceber, valorDaLinha,
} from './visaoGeralUtils';
import './visaoGeralMobile.css';

/** Quantas OS aparecem em "Na oficina agora" (o resto está em "Ver todas"). */
const LIMITE_LINHAS = 6;

interface Props {
  vg: VisaoGeral | null;
  vgLoading: boolean;
  vgErro: string | null;
  onRecarregarVg: () => void;
  alertas: ReturnType<typeof useAlertas>;
  onNav: (p: NavPage) => void;
  onNewOS: () => void;
  onAbrirOS: (o: OrdemRow) => void;
  onAcaoAlerta: (acao: AcaoAlerta) => void;
  onIrParaDestino: (d: DestinoCard) => void;
}

const ic = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
const IcSino = <svg {...ic}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
const IcSetaDir = <svg {...ic} width={18} height={18}><path d="m9 18 6-6-6-6" /></svg>;

/** "Sábado, 21 de nov" */
function dataCurta(d: Date = new Date()): string {
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${d.getDate()} de ${mes}`;
}

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function Kpi({ rotulo, valor, contexto, loading, onAbrir }: {
  rotulo: string; valor: React.ReactNode; contexto: React.ReactNode; loading: boolean; onAbrir: () => void;
}) {
  return (
    <button type="button" className="vgm-kpi" onClick={onAbrir} disabled={loading} aria-label={`${rotulo} — abrir`}>
      <span className="vgm-kpi__rotulo">{rotulo}</span>
      {loading ? <Skeleton h={28} w={60} r={6} /> : <span className="vgm-kpi__valor">{valor}</span>}
      {loading ? <Skeleton h={14} w="75%" r={4} /> : <span className="vgm-kpi__contexto">{contexto}</span>}
    </button>
  );
}

/**
 * Tela "Hoje" no celular (redesign). Sem top-bar: o nome da oficina, o olhinho e o sino ficam
 * no próprio cabeçalho da tela, como no Figma. A busca global ainda não existe, então o ícone
 * de lupa do Figma não foi colocado (um botão que não faz nada no toque só atrapalha).
 */
export function VisaoGeralMobile({
  vg, vgLoading, vgErro, onRecarregarVg, alertas, onNav, onNewOS, onAbrirOS, onAcaoAlerta, onIrParaDestino,
}: Props) {
  const nomeOficina = useNomeOficina();
  const { can } = usePermissions();
  const verValor = can('financeiro.ver');
  const { ordens, colunas, clientesNaoAvisados, loading: atLoading, erro: atErro, reload } = useAtendimento();
  const carregando = atLoading && ordens.length === 0;

  const linhas = useMemo(() => linhasDoPatio(colunas), [colunas]);
  const contagem = useMemo(() => contagemPatio(linhas), [linhas]);
  const pendentes = useMemo(() => ordens.filter(o => o.status === 'pendente_aprovacao'), [ordens]);
  const visiveis = linhas.slice(0, LIMITE_LINHAS);

  const naOficina = contagem.todas;
  const contextoOS = naOficina === 0 ? 'Nenhuma OS em andamento' : `${contagem.em_execucao} em execução · ${contagem.bloqueado} peça`;
  const contextoProntas = contagem.prontas === 0
    ? 'Nenhuma OS concluída hoje'
    : clientesNaoAvisados.length > 0 ? `${plural(clientesNaoAvisados.length, 'cliente', 'clientes')} p/ avisar` : 'Clientes avisados';

  const fat = vg?.faturamento ?? null;
  const meta = vg?.meta?.valor ?? null;
  const contextoFat = fat && meta && meta > 0
    ? <Valor texto={`${Math.round((fat.atual / meta) * 100)}% da meta`} mascara="••% da meta" />
    : 'No mês corrente';

  const linhasAlerta = alertas.grupos.map(linhaDoGrupo);
  const totalAlertas = alertas.total;

  return (
    <div className="vgm-page">
      {/* ── Topo (no lugar da top-bar) ── */}
      <header className="vgm-topo">
        <div className="vgm-barra">
          <span className="vgm-oficina">{nomeOficina || 'Oficina'}</span>
          <BotaoPrivacidade variante="mobile" />
          <button
            type="button" className="vgm-btn-icone" onClick={() => onNav('alertas')}
            aria-label={totalAlertas > 0 ? `Ver alertas (${totalAlertas})` : 'Ver alertas'}
          >
            {IcSino}
            {totalAlertas > 0 && <span className="vgm-badge">{totalAlertas > 99 ? '99+' : totalAlertas}</span>}
          </button>
        </div>
        <div className="vgm-titulo-bloco">
          <h1 className="vgm-titulo">Hoje</h1>
          <p className="vgm-subtitulo">{dataCurta()}{!carregando && <> · {carrosNaOficina(naOficina)}</>}</p>
        </div>
      </header>

      {(vgErro || atErro) && (
        <div className="vgm-erro" role="alert">
          <span>{atErro ?? vgErro}</span>
          <button type="button" className="vgm-link" onClick={() => { if (atErro) reload(); if (vgErro) onRecarregarVg(); }}>Tentar novamente</button>
        </div>
      )}

      {/* ── KPIs 2×2 ── */}
      <section className="vgm-kpis" aria-label="Resumo">
        <Kpi rotulo="Ordens de serviço" valor={naOficina} contexto={contextoOS} loading={carregando} onAbrir={() => onNav('atendimento')} />
        <Kpi rotulo="Aguardando aprovação" valor={pendentes.length} contexto={maisAntigoTexto(pendentes)} loading={carregando} onAbrir={() => onNav('ordens')} />
        <Kpi rotulo="Pronto p/ entregar" valor={contagem.prontas} contexto={contextoProntas} loading={carregando} onAbrir={() => onNav('atendimento')} />
        {(vgLoading || fat) && (
          <Kpi
            rotulo="Faturado no mês"
            valor={fat ? <Valor texto={reais(fat.atual)} mascara={`R$ ${MASCARA_NUMERO}`} /> : ''}
            contexto={contextoFat} loading={vgLoading || !fat}
            onAbrir={() => onIrParaDestino(DESTINOS_VISAO_GERAL.faturamentoMes)}
          />
        )}
      </section>

      {/* ── Precisa de você ── */}
      <section className="vgm-secao" aria-label="Precisa de você">
        <div className="vgm-secao__cab"><h2>Precisa de você</h2></div>
        <ul className="vgm-lista">
          {alertas.loading && Array.from({ length: 3 }).map((_, i) => <li key={i} className="vgm-alerta"><Skeleton h={38} r={4} /></li>)}
          {!alertas.loading && alertas.erro && <li className="vgm-vazio">{alertas.erro}</li>}
          {!alertas.loading && !alertas.erro && linhasAlerta.length === 0 && <li className="vgm-vazio">Nenhum alerta no momento.</li>}
          {!alertas.loading && linhasAlerta.map(({ grupo, acao }) => {
            const n = grupo.itens.length;
            const aReceber = totalAReceber(grupo, alertas.backend);
            return (
              <li key={grupo.fonte.id}>
                <button type="button" className="vgm-alerta" onClick={() => (acao ? onAcaoAlerta(acao) : onNav('alertas'))}>
                  <span className={`vgm-alerta__icone vgm-alerta__icone--${grupo.severidade}`}>{iconeDaFonte(grupo.fonte.id)}</span>
                  <span className="vgm-textos">
                    <strong>{grupo.fonte.resumo(n)}</strong>
                    <small>{aReceber !== null ? <Valor texto={`${formatBRL(aReceber)} a receber`} /> : detalheDoGrupo(grupo.itens)}</small>
                  </span>
                  <span className="vgm-seta">{IcSetaDir}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Na oficina agora ── */}
      <section className="vgm-secao" aria-label="Na oficina agora">
        <div className="vgm-secao__cab">
          <h2>Na oficina agora</h2>
          <button type="button" className="vgm-link vgm-link--escuro" onClick={() => onNav('atendimento')}>Ver todas</button>
        </div>
        <ul className="vgm-lista">
          {carregando && Array.from({ length: 3 }).map((_, i) => <li key={i} className="vgm-os"><Skeleton h={58} r={4} /></li>)}
          {!carregando && visiveis.length === 0 && <li className="vgm-vazio">Nenhum carro na oficina agora.</li>}
          {!carregando && visiveis.map(({ ordem }) => {
            const valor = valorDaLinha(ordem);
            return (
              <li key={ordem.id}>
                <button type="button" className="vgm-os" onClick={() => onAbrirOS(ordem)} aria-label={`Abrir OS ${ordem.os_num} de ${ordem.cliente}`}>
                  <span className="vgm-os__l1">
                    <span className="vgm-mono">#{ordem.os_num}</span>
                    <StatusOS status={ordem.status} />
                  </span>
                  <span className="vgm-os__l2">
                    <Placa placa={ordem.placa} />
                    <span className="vgm-textos">
                      <strong>{ordem.cliente || '—'}</strong>
                      <small>{veiculoDaOrdem(ordem)}</small>
                    </span>
                    {verValor && (
                      <span className="vgm-valor">{valor === null ? '—' : <Valor texto={formatBRL(valor)} mascara={`R$ ${MASCARA_NUMERO}`} />}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Nova OS (botão flutuante, acima da barra de abas) ── */}
      <button type="button" className="vgm-fab" onClick={onNewOS}>{IcMais}Nova OS</button>
    </div>
  );
}

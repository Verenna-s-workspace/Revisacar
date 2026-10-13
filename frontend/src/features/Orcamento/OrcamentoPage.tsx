import { useMemo, useState } from 'react';
import type { useOrdemServico } from '../../hooks/useOrdemServico';
import { useOrcamento } from '../../hooks/useOrcamento';
import { usePermissions } from '../../hooks/usePermissions';
import { tokens } from '../../constants';
import { btnAccent, btnGhost, btnSolid, btnDisabled, pfNote, useResponsive } from '../../components/ui';
import { formatBRL } from '../../utils/dashboard';
import { api } from '../../utils/api';
import { mensagemDoErro } from '../../utils/api_erro';
import { ROTULO_STATUS } from '../../utils/ordem_status';
import {
  apontamentosDoDiagnostico, custoDosItens, dadosDoPayload, dataBR, itensSemPreco, LIMITES,
  mesclarPecasDoDiagnostico, pecasDoDiagnostico, resumoEfeitos, ROTULO_CANAL, servicoDoApontamento, totalDosItens,
} from '../../utils/orcamento_utils';
import { ItensEditor } from './ItensEditor';
import { ItensLeitura } from './ItensLeitura';
import { SeloStatusOrcamento, VersoesLista } from './VersoesLista';
import { AprovarModal, RecusarModal } from './DecisaoModais';
import type { StatusOrdem } from '../../utils/ordem_status';

interface Props {
  /** Estado da OS compartilhado com as etapas 1 e 2 (vive no App). */
  os: ReturnType<typeof useOrdemServico>;
  onBackToStart: () => void;
  onGoEntrada: () => void;
  onGoDiagnostico: () => void;
}

const cartao: React.CSSProperties = {
  border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.lg, background: tokens.color.card,
};
const tituloBloco: React.CSSProperties = {
  fontFamily: tokens.fontMono, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: tokens.color.subtle, margin: 0,
};
const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontFamily: tokens.fontSans, fontSize: '0.86rem',
  color: tokens.color.text, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md, outline: 'none',
};

function Aviso({ tom, children }: { tom: 'info' | 'ok' | 'warn' | 'crit'; children: React.ReactNode }) {
  const cores = {
    info: [tokens.color.textSecond, tokens.color.surfaceHigh, tokens.color.border],
    ok: [tokens.color.ok, tokens.color.okBg, tokens.color.okBorder],
    warn: [tokens.color.warn, tokens.color.warnBg, tokens.color.warnBorder],
    crit: [tokens.color.crit, tokens.color.critBg, tokens.color.critBorder],
  }[tom];
  return (
    <div role={tom === 'crit' ? 'alert' : 'status'} style={{
      color: cores[0], background: cores[1], border: `1px solid ${cores[2]}`, borderRadius: tokens.radius.md,
      padding: '10px 14px', fontSize: '0.84rem', lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

export default function OrcamentoPage({ os, onBackToStart, onGoEntrada, onGoDiagnostico }: Props) {
  const { can } = usePermissions();
  const { isDesktop } = useResponsive();
  const podeEditar = can('ordens.editar');
  const podeVerCusto = can('financeiro.ver_margem');

  const orc = useOrcamento({ ordemId: os.orderId, podeVerCusto, podeEditar });
  const [verId, setVerId] = useState<string | null>(null);
  const [modal, setModal] = useState<'aprovar' | 'recusar' | null>(null);

  const dados = useMemo(
    () => dadosDoPayload({ tabela_pecas: os.tabelaPecas, checklist: os.checklist }),
    [os.tabelaPecas, os.checklist],
  );
  const pecasDiag = useMemo(() => pecasDoDiagnostico(dados, orc.estoque), [dados, orc.estoque]);
  const pecasQueFaltam = useMemo(
    () => mesclarPecasDoDiagnostico(orc.itens, pecasDiag).length - orc.itens.length,
    [orc.itens, pecasDiag],
  );
  const apontamentos = useMemo(() => apontamentosDoDiagnostico(dados, orc.itens), [dados, orc.itens]);

  const visto = (verId ? orc.versoes.find(v => v.id === verId) : null) ?? orc.atual;
  const emEdicao = !!visto && visto.status === 'rascunho' && visto.id === orc.rascunho?.id && podeEditar;
  const ehAtual = !!visto && visto.id === orc.atual?.id;
  const ocupado = orc.acao !== null;

  const totalEdicao = totalDosItens(orc.itens);
  const custoEdicao = custoDosItens(orc.itens);
  const totalExibido = emEdicao ? totalEdicao : visto?.total ?? 0;
  const totalPecas = emEdicao
    ? totalDosItens(orc.itens.filter(i => i.tipo === 'peca'))
    : (visto?.itens ?? []).filter(i => i.tipo === 'peca').reduce((s, i) => s + i.subtotal, 0);
  const totalServicos = Math.round((totalExibido - totalPecas) * 100) / 100;

  // Sair com alterações não salvas: pergunta antes.
  const sair = (fn: () => void) => () => {
    if (orc.sujo && !window.confirm('Há alterações não salvas neste orçamento. Sair e descartá-las?')) return;
    fn();
  };

  const sincronizarOS = (statusNovo: string | null) => {
    if (statusNovo) os.setOrdemStatus(statusNovo);
  };

  const montarPrimeiro = async () => {
    const criado = await orc.criarRascunho(pecasDiag);
    if (criado) {
      setVerId(null);
      sincronizarOS(criado.osStatus ?? null);
    }
  };

  const novaVersao = async () => {
    const criado = await orc.criarRascunho();
    if (criado) {
      setVerId(null);
      sincronizarOS(criado.osStatus ?? null);
    }
  };

  const enviar = async () => {
    const semPreco = itensSemPreco(orc.itens);
    if (semPreco.length > 0 && !window.confirm(
      `${semPreco.length === 1 ? '1 item está' : `${semPreco.length} itens estão`} sem preço (R$ 0,00). Enviar mesmo assim?`,
    )) return;
    const statusOS = await orc.enviar();
    if (statusOS) {
      setVerId(null);
      sincronizarOS(statusOS);
    }
  };

  const aprovar = async (canal: Parameters<typeof orc.aprovar>[0], obs: string, assinatura: string | null) => {
    const statusOS = await orc.aprovar(canal, obs, assinatura);
    if (statusOS) {
      setModal(null);
      sincronizarOS(statusOS);
    }
  };

  const [baixando, setBaixando] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const baixarPdf = async (id: string, versao: number) => {
    setBaixando(true);
    setErroPdf(null);
    try {
      const blob = await api.baixarPdfOrcamento(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orcamento-${(os.osHeader.os_num || 'OS').replace(/[^\w-]+/g, '_')}-v${versao}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setErroPdf(mensagemDoErro(e, 'Não foi possível gerar o PDF.'));
    } finally {
      setBaixando(false);
    }
  };

  const recusar = async (motivo: string) => {
    const statusOS = await orc.recusar(motivo);
    if (statusOS) {
      setModal(null);
      sincronizarOS(statusOS);
    }
  };

  const resumoFx = useMemo(() => resumoEfeitos(orc.efeitos), [orc.efeitos]);
  const nomeOS = os.osHeader.os_num || 'OS';
  const statusOS = os.ordemStatus as StatusOrdem | null;

  // ── Cabeçalho (sempre visível) ───────────────────────────────────────────
  const cabecalho = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 20px',
      background: tokens.color.surface, borderBottom: `1px solid ${tokens.color.border}`,
    }}>
      <button type="button" onClick={sair(onBackToStart)} style={btnGhost}>← Painel</button>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text }}>Orçamento · {nomeOS}</h1>
        <div style={{ fontSize: '0.78rem', color: tokens.color.muted }}>
          {[os.cliente.nome, [os.veiculo.modelo, os.veiculo.placa].filter(Boolean).join(' · ')].filter(Boolean).join(' — ') || 'OS sem identificação'}
        </div>
      </div>
      {statusOS && ROTULO_STATUS[statusOS] && (
        <span style={{ fontFamily: tokens.fontMono, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.textSecond, background: tokens.color.surfaceHigh, borderRadius: tokens.radius.full, padding: '4px 12px' }}>
          OS: {ROTULO_STATUS[statusOS]}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={sair(onGoEntrada)} style={btnGhost}>Entrada</button>
        <button type="button" onClick={sair(onGoDiagnostico)} style={btnGhost}>Diagnóstico</button>
      </div>
    </div>
  );

  const moldura = (conteudo: React.ReactNode) => (
    <div style={{ fontFamily: tokens.fontSans, background: tokens.color.bg, minHeight: '100vh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      {cabecalho}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {conteudo}
      </div>
    </div>
  );

  // ── Estados sem orçamento para mostrar ───────────────────────────────────
  if (!os.orderId) {
    return moldura(
      <Aviso tom="warn">
        A OS ainda não foi salva. Preencha e salve a entrada (cliente, veículo e técnico) e o diagnóstico antes de montar o orçamento.
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button type="button" onClick={onGoEntrada} style={btnSolid}>Ir para a entrada</button>
        </div>
      </Aviso>,
    );
  }

  if (orc.carregando && orc.versoes.length === 0) {
    return moldura(<div style={{ ...pfNote, padding: 24, textAlign: 'center' }}>Carregando orçamento…</div>);
  }

  if (orc.erro) {
    return moldura(
      <Aviso tom="crit">
        {orc.erro}
        <div style={{ marginTop: 10 }}><button type="button" onClick={orc.recarregar} style={btnSolid}>Tentar de novo</button></div>
      </Aviso>,
    );
  }

  if (!visto) {
    const osEmRascunho = statusOS === 'rascunho';
    return moldura(
      <div style={{ ...cartao, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text }}>Ainda não há orçamento para esta OS</h2>
        <p style={{ margin: 0, fontSize: '0.88rem', color: tokens.color.textSecond, lineHeight: 1.55 }}>
          {pecasDiag.length > 0
            ? `O diagnóstico lista ${pecasDiag.length} ${pecasDiag.length === 1 ? 'peça' : 'peças'} para trocar. Elas entram no orçamento já preenchidas (com o preço do estoque, quando a peça é encontrada).`
            : 'O diagnóstico não tem peças na tabela. Você pode montar o orçamento do zero.'}
        </p>
        {osEmRascunho && (
          <Aviso tom="warn">
            A OS ainda está como rascunho: complete a entrada (cliente, telefone, veículo e técnico responsável) e salve para liberar o orçamento.
          </Aviso>
        )}
        {orc.erroAcao && <Aviso tom="crit">{orc.erroAcao}</Aviso>}
        {podeEditar ? (
          <button type="button" onClick={montarPrimeiro} disabled={ocupado} style={ocupado ? btnDisabled : btnAccent}>
            {orc.acao === 'criando' ? 'Criando…' : 'Montar orçamento'}
          </button>
        ) : (
          <span style={pfNote}>Seu cargo pode consultar orçamentos, mas não criá-los.</span>
        )}
      </div>,
    );
  }

  // ── Faixa de situação da versão em foco ──────────────────────────────────
  let faixa: React.ReactNode = null;
  if (visto.status === 'enviado') {
    faixa = visto.vencido ? (
      <Aviso tom="crit">
        Este orçamento <strong>venceu em {dataBR(visto.validadeAte)}</strong> e não pode mais ser aprovado. Crie uma nova versão (ela parte dos mesmos itens) e envie de novo.
      </Aviso>
    ) : (
      <Aviso tom="warn">
        Aguardando a resposta do cliente{visto.validadeAte ? ` · vale até ${dataBR(visto.validadeAte)}` : ''}.
        Quando ele responder, registre a aprovação ou a recusa.
      </Aviso>
    );
  } else if (visto.status === 'aprovado') {
    faixa = (
      <Aviso tom="ok">
        Aprovado{visto.aprovadoPorNome ? ` (registrado por ${visto.aprovadoPorNome})` : ''}
        {visto.aprovacaoCanal ? ` · ${ROTULO_CANAL[visto.aprovacaoCanal]}` : ''}
        {visto.aprovadoEm ? ` · ${dataBR(visto.aprovadoEm)}` : ''}.
        {visto.aprovacaoObs ? ` “${visto.aprovacaoObs}”` : ''}
      </Aviso>
    );
  } else if (visto.status === 'recusado') {
    faixa = (
      <Aviso tom="crit">
        Recusado{visto.recusadoEm ? ` em ${dataBR(visto.recusadoEm)}` : ''}.
        {visto.motivoRecusa ? ` Motivo: ${visto.motivoRecusa}` : ' Sem motivo registrado.'}
      </Aviso>
    );
  } else if (visto.status === 'substituido') {
    faixa = <Aviso tom="info">Esta versão foi substituída por uma mais nova e fica aqui só como histórico.</Aviso>;
  } else if (!podeEditar) {
    faixa = <Aviso tom="info">Rascunho em preparação — seu cargo pode consultar, mas não editar.</Aviso>;
  }

  // ── Ações da versão em foco ──────────────────────────────────────────────
  const acoes: React.ReactNode[] = [];
  if (emEdicao) {
    acoes.push(
      <button key="salvar" type="button" onClick={() => { void orc.salvar(); }} disabled={ocupado || !orc.sujo}
        style={ocupado || !orc.sujo ? btnDisabled : btnSolid}>
        {orc.acao === 'salvando' ? 'Salvando…' : 'Salvar rascunho'}
      </button>,
      <button key="enviar" type="button" onClick={enviar} disabled={ocupado || orc.itens.length === 0}
        style={ocupado || orc.itens.length === 0 ? btnDisabled : btnAccent}>
        {orc.acao === 'enviando' ? 'Enviando…' : 'Enviar para aprovação'}
      </button>,
    );
    if (orc.sujo) {
      acoes.push(<button key="descartar" type="button" onClick={orc.descartarAlteracoes} disabled={ocupado} style={btnGhost}>Descartar alterações</button>);
    }
  } else if (podeEditar && ehAtual) {
    if (visto.status === 'enviado') {
      acoes.push(
        <button key="aprovar" type="button" onClick={() => { orc.setErroAcao(null); setModal('aprovar'); }}
          disabled={ocupado || !!visto.vencido} style={ocupado || visto.vencido ? btnDisabled : btnAccent}>
          Registrar aprovação
        </button>,
        <button key="recusar" type="button" onClick={() => { orc.setErroAcao(null); setModal('recusar'); }} disabled={ocupado} style={btnSolid}>
          Registrar recusa
        </button>,
        <button key="revisar" type="button" onClick={novaVersao} disabled={ocupado} style={btnGhost}>
          {orc.acao === 'criando' ? 'Criando…' : 'Revisar (nova versão)'}
        </button>,
      );
    } else if (visto.status === 'aprovado') {
      acoes.push(
        <button key="revisar" type="button" onClick={novaVersao} disabled={ocupado} style={btnSolid}>
          {orc.acao === 'criando' ? 'Criando…' : 'Revisar (nova versão)'}
        </button>,
        <button key="cancelar" type="button" onClick={() => { orc.setErroAcao(null); setModal('recusar'); }} disabled={ocupado} style={btnGhost}>
          Cancelar orçamento
        </button>,
      );
    } else if (visto.status === 'recusado') {
      acoes.push(
        <button key="refazer" type="button" onClick={novaVersao} disabled={ocupado} style={btnAccent}>
          {orc.acao === 'criando' ? 'Criando…' : 'Refazer orçamento'}
        </button>,
      );
    }
  }

  if (visto.itens.length > 0 && !(emEdicao && orc.sujo)) {
    acoes.push(
      <button key="pdf" type="button" onClick={() => { void baixarPdf(visto.id, visto.versao); }} disabled={baixando}
        style={baixando ? btnDisabled : btnGhost}
        title={visto.status === 'rascunho' ? 'Pré-visualização com marca d\'água' : 'PDF para o cliente (só preço cobrado)'}>
        {baixando ? 'Gerando PDF…' : visto.status === 'rascunho' ? 'Pré-visualizar PDF' : 'Baixar PDF'}
      </button>,
    );
  }

  // ── Coluna principal ─────────────────────────────────────────────────────
  const principal = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Versão {visto.versao}</h2>
        <SeloStatusOrcamento status={visto.status} vencido={visto.vencido} />
        {orc.sujo && emEdicao && <span style={pfNote}>alterações não salvas</span>}
      </div>

      {faixa}
      {orc.erroAcao && modal === null && <Aviso tom="crit">{orc.erroAcao}</Aviso>}
      {resumoFx && (
        <Aviso tom={resumoFx.tom}>
          {resumoFx.linhas.map(l => <div key={l}>{l}</div>)}
        </Aviso>
      )}
      {orc.avisoPdf && <Aviso tom="warn">{orc.avisoPdf}</Aviso>}
      {erroPdf && <Aviso tom="crit">{erroPdf}</Aviso>}

      <div style={{ ...cartao, padding: 14 }}>
        {emEdicao ? (
          <>
            <ItensEditor
              itens={orc.itens} erros={orc.errosItens} mostrarErros={orc.mostrarErros} podeVerCusto={podeVerCusto}
              estoque={orc.estoque} servicos={orc.servicos}
              onAtualizar={orc.atualizarItem} onRemover={orc.removerItem}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" onClick={() => orc.adicionarItem('peca')} style={btnSolid}>+ Peça</button>
              <button type="button" onClick={() => orc.adicionarItem('servico')} style={btnSolid}>+ Serviço</button>
              {pecasQueFaltam > 0 && (
                <button type="button" onClick={() => orc.substituirItens(mesclarPecasDoDiagnostico(orc.itens, pecasDiag))} style={btnGhost}>
                  Trazer {pecasQueFaltam} {pecasQueFaltam === 1 ? 'peça' : 'peças'} do diagnóstico
                </button>
              )}
            </div>
            {orc.itens.length >= LIMITES.itens && <div style={{ ...pfNote, marginTop: 8 }}>Limite de {LIMITES.itens} itens por orçamento.</div>}
          </>
        ) : (
          <ItensLeitura itens={visto.itens} />
        )}
      </div>

      {emEdicao && apontamentos.length > 0 && (
        <div style={{ ...cartao, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={tituloBloco}>Apontamentos do diagnóstico sem item no orçamento</h3>
          {apontamentos.map(a => (
            <div key={a.chave} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.84rem' }}>
              <span style={{
                fontFamily: tokens.fontMono, fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: tokens.radius.full, padding: '2px 8px',
                color: a.status === 'crit' ? tokens.color.crit : tokens.color.warn,
                background: a.status === 'crit' ? tokens.color.critBg : tokens.color.warnBg,
              }}>{a.status === 'crit' ? 'crítico' : 'atenção'}</span>
              <span style={{ color: tokens.color.text }}><strong>{a.nome}</strong> <span style={{ color: tokens.color.muted }}>· {a.secao}{a.obs ? ` — ${a.obs}` : ''}</span></span>
              <button type="button" onClick={() => orc.adicionarItens([servicoDoApontamento(a, orc.servicos)])}
                style={{ ...btnGhost, marginLeft: 'auto', padding: '5px 12px' }}>
                + Serviço
              </button>
            </div>
          ))}
        </div>
      )}

      <VersoesLista versoes={orc.versoes} selecionadaId={visto.id} onSelecionar={setVerId} />
    </div>
  );

  // ── Resumo lateral ───────────────────────────────────────────────────────
  const custoVisivel = podeVerCusto && (emEdicao ? orc.itens.some(i => i.custoUnitario.trim() !== '') : visto.custoTotal != null);
  const custoTotal = emEdicao ? custoEdicao : visto.custoTotal ?? 0;
  const margem = Math.round((totalExibido - custoTotal) * 100) / 100;
  const margemPct = totalExibido > 0 ? Math.round((margem / totalExibido) * 1000) / 10 : null;

  const resumo = (
    <aside style={{ ...cartao, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start', position: isDesktop ? 'sticky' : 'static', top: 12 }}>
      <h3 style={tituloBloco}>Resumo</h3>
      <div>
        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: tokens.color.ferrari }}>{formatBRL(totalExibido)}</div>
        <div style={{ fontSize: '0.76rem', color: tokens.color.muted }}>
          {emEdicao ? orc.itens.length : visto.itens.length} {(emEdicao ? orc.itens.length : visto.itens.length) === 1 ? 'item' : 'itens'}
          {' · '}peças {formatBRL(totalPecas)} · serviços {formatBRL(totalServicos)}
        </div>
      </div>

      {custoVisivel && (
        <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 12, fontSize: '0.82rem', color: tokens.color.textSecond, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Custo</span><strong>{formatBRL(custoTotal)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Margem</span>
            <strong style={{ color: margem >= 0 ? tokens.color.ok : tokens.color.crit }}>
              {formatBRL(margem)}{margemPct != null ? ` (${margemPct.toLocaleString('pt-BR')}%)` : ''}
            </strong>
          </div>
          {(emEdicao ? orc.itens.some(i => i.custoUnitario.trim() === '') : visto.itens.some(i => i.custoUnitario == null)) && (
            <div style={pfNote}>Há itens sem custo informado — a margem considera só os custos preenchidos.</div>
          )}
          <div style={pfNote}>Visível só para quem acompanha a margem; não vai no PDF.</div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {emEdicao ? (
          <>
            <div>
              <label htmlFor="orc-validade" style={{ ...tituloBloco, display: 'block', marginBottom: 4 }}>Validade (dias)</label>
              <input id="orc-validade" value={orc.validadeDias} inputMode="numeric" onChange={e => orc.setValidadeDias(e.target.value)}
                style={{ ...campo, borderColor: orc.mostrarErros && orc.diasValidos == null ? tokens.color.crit : tokens.color.border }} />
              <div style={{ ...pfNote, marginTop: 4 }}>
                {orc.diasValidos == null && orc.mostrarErros ? 'Use de 1 a 90 dias.' : 'Conta a partir do envio ao cliente.'}
              </div>
            </div>
            <div>
              <label htmlFor="orc-obs" style={{ ...tituloBloco, display: 'block', marginBottom: 4 }}>Observações</label>
              <textarea id="orc-obs" value={orc.observacoes} rows={3} onChange={e => orc.setObservacoes(e.target.value)}
                placeholder="Condições, prazo estimado, garantia…" style={{ ...campo, resize: 'vertical' }} />
              {orc.observacoesLongas && <div style={{ fontSize: '0.74rem', color: tokens.color.crit }}>Máximo de {LIMITES.observacoes} caracteres.</div>}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>
              Validade: {visto.validadeDias} {visto.validadeDias === 1 ? 'dia' : 'dias'}
              {visto.validadeAte ? ` · até ${dataBR(visto.validadeAte)}` : ''}
            </div>
            {visto.observacoes && <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond, whiteSpace: 'pre-wrap' }}>{visto.observacoes}</div>}
          </>
        )}
      </div>

      {acoes.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{acoes.map(a => <div key={(a as { key: string }).key} style={{ display: 'flex', flexDirection: 'column' }}>{a}</div>)}</div>}
    </aside>
  );

  return moldura(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'minmax(0, 1fr) 320px' : 'minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        {principal}
        {resumo}
      </div>

      {modal === 'aprovar' && orc.atual && (
        <AprovarModal
          versao={orc.atual.versao} total={formatBRL(orc.atual.total)} ocupado={orc.acao === 'aprovando'} erro={orc.erroAcao}
          onFechar={() => setModal(null)} onConfirmar={aprovar}
        />
      )}
      {modal === 'recusar' && orc.atual && (
        <RecusarModal
          versao={orc.atual.versao} aprovado={orc.atual.status === 'aprovado'} ocupado={orc.acao === 'recusando'} erro={orc.erroAcao}
          onFechar={() => setModal(null)} onConfirmar={recusar}
        />
      )}
    </>,
  );
}

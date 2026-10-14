import { useCallback, useEffect, useState } from 'react';
import type { useOrdemServico } from '../../hooks/useOrdemServico';
import { usePermissions } from '../../hooks/usePermissions';
import { tokens } from '../../constants';
import { btnAccent, btnDisabled, btnGhost, btnSolid, pfNote } from '../../components/ui';
import { api } from '../../utils/api';
import { corpoDoErro, mensagemDoErro } from '../../utils/api_erro';
import { formatBRL } from '../../utils/dashboard';
import { ROTULO_STATUS } from '../../utils/ordem_status';
import type { StatusOrdem } from '../../utils/ordem_status';
import { dataBR } from '../../utils/orcamento_utils';
import { ItensLeitura } from '../Orcamento/ItensLeitura';
import type { FaltaAoConcluir, Fechamento } from '../../types/fechamento';

interface Props {
  os: ReturnType<typeof useOrdemServico>;
  onBackToStart: () => void;
  onGoOrcamento: () => void;
}

const cartao: React.CSSProperties = {
  border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.lg, background: tokens.color.card, padding: 16,
  display: 'flex', flexDirection: 'column', gap: 10,
};
const tituloBloco: React.CSSProperties = {
  fontFamily: tokens.fontMono, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: tokens.color.subtle, margin: 0,
};
const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontFamily: tokens.fontSans, fontSize: '0.86rem',
  color: tokens.color.text, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md, outline: 'none', resize: 'vertical',
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
    }}>{children}</div>
  );
}

const unidades = (n: number) => String(n).replace('.', ',');
const dataHora = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? dataBR(iso) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

type Acao = 'carregando' | 'iniciando' | 'pausando' | 'retomando' | 'concluindo';

export default function FechamentoPage({ os, onBackToStart, onGoOrcamento }: Props) {
  const { can } = usePermissions();
  const podeEditar = can('ordens.editar');
  const [dados, setDados] = useState<Fechamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<Acao | null>('carregando');
  const [modal, setModal] = useState(false);
  const [obs, setObs] = useState('');
  const [faltas, setFaltas] = useState<FaltaAoConcluir[] | null>(null);
  const [erroModal, setErroModal] = useState<string | null>(null);

  const ordemId = os.orderId;

  const carregar = useCallback(async () => {
    if (!ordemId) return;
    setAcao('carregando');
    try {
      const d = (await api.obterFechamento(ordemId)) as Fechamento;
      setDados(d);
      setErro(null);
      os.setOrdemStatus(d.osStatus);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível carregar o fechamento.'));
    } finally {
      setAcao(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const mudarStatus = async (novo: string, qual: Acao) => {
    if (!ordemId) return;
    setAcao(qual);
    setErro(null);
    try {
      await api.definirStatusOrdem(ordemId, novo);
      os.setOrdemStatus(novo);
      await carregar();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível mudar o status da OS.'));
      setAcao(null);
    }
  };

  const concluir = async (ignorarFaltas: boolean) => {
    if (!ordemId) return;
    setAcao('concluindo');
    setErroModal(null);
    try {
      const d = (await api.concluirOrdem(ordemId, { observacao: obs.trim(), ignorarFaltas })) as Fechamento;
      setDados(d);
      os.setOrdemStatus(d.osStatus);
      setModal(false);
      setFaltas(null);
      setObs('');
    } catch (e) {
      const corpo = corpoDoErro<{ codigo?: string; faltas?: FaltaAoConcluir[] }>(e);
      if (corpo?.codigo === 'estoque_insuficiente' && corpo.faltas) setFaltas(corpo.faltas);
      else setErroModal(mensagemDoErro(e, 'Não foi possível concluir a OS.'));
    } finally {
      setAcao(null);
    }
  };

  const status = (dados?.osStatus ?? os.ordemStatus) as StatusOrdem | null;
  const nomeOS = dados?.osNum || os.osHeader.os_num || 'OS';
  const ocupado = acao !== null;
  const reservasComFalta = dados?.reservas.filter(r => r.falta) ?? [];

  const cabecalho = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 20px',
      background: tokens.color.surface, borderBottom: `1px solid ${tokens.color.border}`,
    }}>
      <button type="button" onClick={onBackToStart} style={btnGhost}>← Painel</button>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text }}>Fechamento · {nomeOS}</h1>
        <div style={{ fontSize: '0.78rem', color: tokens.color.muted }}>
          {[os.cliente.nome, [os.veiculo.modelo, os.veiculo.placa].filter(Boolean).join(' · ')].filter(Boolean).join(' — ')}
        </div>
      </div>
      {status && ROTULO_STATUS[status] && (
        <span style={{ fontFamily: tokens.fontMono, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.textSecond, background: tokens.color.surfaceHigh, borderRadius: tokens.radius.full, padding: '4px 12px' }}>
          OS: {ROTULO_STATUS[status]}
        </span>
      )}
      <div style={{ marginLeft: 'auto' }}>
        <button type="button" onClick={onGoOrcamento} style={btnGhost}>Orçamento</button>
      </div>
    </div>
  );

  const moldura = (conteudo: React.ReactNode) => (
    <div style={{ fontFamily: tokens.fontSans, background: tokens.color.bg, minHeight: '100vh', paddingBottom: 'var(--mobile-bottom-nav-h)' }}>
      {cabecalho}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {conteudo}
      </div>
    </div>
  );

  if (!ordemId) return moldura(<Aviso tom="warn">Abra uma OS salva para ver o fechamento.</Aviso>);
  if (!dados) {
    return moldura(erro ? <Aviso tom="crit">{erro}</Aviso> : <div style={{ color: tokens.color.muted }}>Carregando…</div>);
  }

  // ── Execução ──────────────────────────────────────────────────────────────
  const botoesExecucao: React.ReactNode[] = [];
  if (podeEditar) {
    if (status === 'aprovada') {
      botoesExecucao.push(
        <button key="ini" type="button" disabled={ocupado} style={ocupado ? btnDisabled : btnAccent}
          onClick={() => { void mudarStatus('em_execucao', 'iniciando'); }}>
          {acao === 'iniciando' ? 'Iniciando…' : 'Iniciar execução'}
        </button>,
      );
    }
    if (status === 'em_execucao') {
      botoesExecucao.push(
        <button key="con" type="button" disabled={ocupado} style={ocupado ? btnDisabled : btnAccent}
          onClick={() => { setErroModal(null); setFaltas(null); setModal(true); }}>Concluir serviço</button>,
        <button key="pau" type="button" disabled={ocupado} style={btnSolid}
          onClick={() => { void mudarStatus('aguardando', 'pausando'); }}>
          {acao === 'pausando' ? 'Pausando…' : 'Pausar (aguardando peças)'}
        </button>,
      );
    }
    if (status === 'aguardando') {
      botoesExecucao.push(
        <button key="ret" type="button" disabled={ocupado} style={ocupado ? btnDisabled : btnAccent}
          onClick={() => { void mudarStatus('em_execucao', 'retomando'); }}>
          {acao === 'retomando' ? 'Retomando…' : 'Retomar execução'}
        </button>,
        <button key="con" type="button" disabled={ocupado} style={btnSolid}
          onClick={() => { setErroModal(null); setFaltas(null); setModal(true); }}>Concluir serviço</button>,
      );
    }
  }

  const concluida = status === 'finalizada';
  const antesDaAprovacao = !!status && ['rascunho', 'em_orcamento', 'pendente_aprovacao', 'recusada'].includes(status);

  return moldura(
    <>
      {erro && <Aviso tom="crit">{erro}</Aviso>}

      <div style={cartao}>
        <h2 style={tituloBloco}>Execução</h2>
        {antesDaAprovacao && (
          <>
            <div style={{ fontSize: '0.88rem', color: tokens.color.textSecond }}>
              {status === 'recusada' ? 'O orçamento foi recusado: não há serviço a executar.' : 'O serviço só começa depois que o cliente aprovar o orçamento.'}
            </div>
            <div><button type="button" onClick={onGoOrcamento} style={btnSolid}>Ir para o orçamento</button></div>
          </>
        )}
        {status === 'aprovada' && <div style={{ fontSize: '0.88rem', color: tokens.color.textSecond }}>Orçamento aprovado. Inicie a execução quando o veículo entrar na bancada.</div>}
        {status === 'em_execucao' && <div style={{ fontSize: '0.88rem', color: tokens.color.textSecond }}>Serviço em andamento. Ao concluir, as peças reservadas saem do estoque.</div>}
        {status === 'aguardando' && <div style={{ fontSize: '0.88rem', color: tokens.color.textSecond }}>Serviço parado, aguardando peças ou resposta.</div>}
        {concluida && (
          <Aviso tom="ok">
            Serviço concluído{dados.concluidaEm ? ` em ${dataHora(dados.concluidaEm)}` : ''}{dados.concluidaPorNome ? ` por ${dados.concluidaPorNome}` : ''}.
            {dados.obsConclusao && <div style={{ marginTop: 4 }}>“{dados.obsConclusao}”</div>}
          </Aviso>
        )}
        {!podeEditar && !concluida && !antesDaAprovacao && <div style={pfNote}>Seu cargo pode consultar, mas não alterar a execução.</div>}
        {botoesExecucao.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{botoesExecucao}</div>}
      </div>

      {dados.orcamento && (
        <div style={cartao}>
          <h2 style={tituloBloco}>Serviço e peças · orçamento v{dados.orcamento.versao}</h2>
          <ItensLeitura itens={dados.orcamento.itens} />
          <div style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 800, color: tokens.color.ferrari }}>
            Total {formatBRL(dados.orcamento.total)}
          </div>
        </div>
      )}

      {(dados.reservas.length > 0 || dados.baixas.length > 0) && (
        <div style={cartao}>
          <h2 style={tituloBloco}>Estoque</h2>
          {dados.reservas.length > 0 && (
            <>
              <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>Reservado para esta OS (sai do estoque ao concluir):</div>
              {dados.reservas.map(r => (
                <div key={r.itemId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.86rem' }}>
                  <span>{r.nome}</span>
                  <span style={{ color: r.falta ? tokens.color.crit : tokens.color.textSecond, fontWeight: r.falta ? 700 : 400 }}>
                    {unidades(r.reservado)} reservado · {unidades(r.disponivel)} em estoque{r.falta ? ' — falta' : ''}
                  </span>
                </div>
              ))}
              {reservasComFalta.length > 0 && !concluida && (
                <Aviso tom="warn">Há peça reservada que não está toda em estoque. Dê entrada no Estoque antes de concluir, ou conclua baixando só o que existe.</Aviso>
              )}
            </>
          )}
          {dados.baixas.length > 0 && (
            <>
              <div style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>Baixado do estoque:</div>
              {dados.baixas.map(b => (
                <div key={b.itemId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span>{b.nome}</span><span>−{unidades(b.quantidade)} un.</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {dados.financeiro && (
        <div style={cartao}>
          <h2 style={tituloBloco}>Financeiro</h2>
          {dados.financeiro.length === 0 && <div style={{ fontSize: '0.86rem', color: tokens.color.muted }}>Nenhum lançamento ligado a esta OS.</div>}
          {dados.financeiro.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.86rem', flexWrap: 'wrap' }}>
              <span>{l.descricao || l.categoria}</span>
              <span>
                <strong>{formatBRL(l.valor)}</strong>{' '}
                <span style={{ color: l.status === 'pago' ? tokens.color.ok : tokens.color.warn }}>
                  · {l.status === 'pago' ? `pago${l.dataPagamento ? ` em ${dataBR(l.dataPagamento)}` : ''}` : 'pendente'}
                </span>
              </span>
            </div>
          ))}
          <div style={pfNote}>Concluir o serviço não recebe o pagamento — registre o recebimento na tela Financeiro.</div>
        </div>
      )}

      {modal && (
        <div role="dialog" aria-modal="true" aria-label="Concluir serviço" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
        }}>
          <div style={{ background: tokens.color.card, borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${tokens.color.border}`, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: tokens.color.text }}>Concluir serviço</h3>
            <p style={{ margin: 0, fontSize: '0.86rem', color: tokens.color.textSecond, lineHeight: 1.5 }}>
              A OS passa para “Concluída” e as peças reservadas saem do estoque. Isso não pode ser desfeito por aqui.
            </p>
            <div>
              <label htmlFor="fech-obs" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 5 }}>OBSERVAÇÃO (OPCIONAL)</label>
              <textarea id="fech-obs" rows={3} maxLength={1000} value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Ex.: cliente retirou o veículo às 17h; peças antigas devolvidas" style={campo} disabled={ocupado} />
            </div>
            {faltas && (
              <Aviso tom="warn">
                <div>Estoque insuficiente — nada foi alterado:</div>
                {faltas.map(f => (
                  <div key={f.itemId}>• {f.nome}: precisa de {unidades(f.necessario)}, há {unidades(f.disponivel)}.</div>
                ))}
                <div style={{ marginTop: 4 }}>Dê entrada das peças no Estoque e tente de novo, ou conclua mesmo assim (baixa só o que existe).</div>
              </Aviso>
            )}
            {erroModal && <Aviso tom="crit">{erroModal}</Aviso>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setModal(false)} style={btnGhost} disabled={ocupado}>Voltar</button>
              {faltas ? (
                <>
                  <button type="button" onClick={() => { void concluir(false); }} style={btnSolid} disabled={ocupado}>Tentar de novo</button>
                  <button type="button" onClick={() => { void concluir(true); }} style={ocupado ? btnDisabled : btnAccent} disabled={ocupado}>
                    {acao === 'concluindo' ? 'Concluindo…' : 'Concluir mesmo assim'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { void concluir(false); }} style={ocupado ? btnDisabled : btnAccent} disabled={ocupado}>
                  {acao === 'concluindo' ? 'Concluindo…' : 'Concluir serviço'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>,
  );
}

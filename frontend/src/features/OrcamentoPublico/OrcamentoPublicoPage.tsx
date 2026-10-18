import { useCallback, useEffect, useState } from 'react';
import { tokens } from '../../constants';
import { apiPublica, ErroPublico } from '../../utils/api_publico';
import { formatBRL } from '../../utils/dashboard';
import { dataBR } from '../../utils/orcamento_utils';
import { mensagemPublica } from '../../utils/orcamento_link_utils';
import type { OrcamentoPublico } from '../../types/orcamento_link';

// Página que o CLIENTE abre pelo link (sem login). Pensada pro celular: uma coluna, botões grandes.
// Só mostra o que o servidor manda em /publico/... (preço cobrado; nunca custo ou margem).

const pagina: React.CSSProperties = {
  minHeight: '100vh', background: tokens.color.bg, fontFamily: tokens.fontSans, color: tokens.color.text,
  display: 'flex', justifyContent: 'center', padding: '20px 16px 48px', boxSizing: 'border-box',
};
const coluna: React.CSSProperties = { width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 };
const cartao: React.CSSProperties = {
  background: tokens.color.card, border: `1px solid ${tokens.color.border}`, borderRadius: 16, padding: 16,
};
const rotulo: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 700, color: tokens.color.textSecond, marginBottom: 6,
};
const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontFamily: tokens.fontSans, fontSize: '1rem',
  color: tokens.color.text, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`,
  borderRadius: 10, outline: 'none',
};
const botao = (fundo: string, cor: string, borda?: string): React.CSSProperties => ({
  width: '100%', padding: '15px 18px', borderRadius: 12, fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
  fontFamily: tokens.fontSans, background: fundo, color: cor, border: borda ?? 'none', minHeight: 50,
});

function Aviso({ tom, children }: { tom: 'ok' | 'warn' | 'crit' | 'info'; children: React.ReactNode }) {
  const [cor, bg, borda] = {
    ok: [tokens.color.ok, tokens.color.okBg, tokens.color.okBorder],
    warn: [tokens.color.warn, tokens.color.warnBg, tokens.color.warnBorder],
    crit: [tokens.color.crit, tokens.color.critBg, tokens.color.critBorder],
    info: [tokens.color.textSecond, tokens.color.surfaceHigh, tokens.color.border],
  }[tom];
  return (
    <div role={tom === 'crit' ? 'alert' : 'status'} style={{
      color: cor, background: bg, border: `1px solid ${borda}`, borderRadius: 12, padding: '12px 14px', fontSize: '0.92rem', lineHeight: 1.5,
    }}>{children}</div>
  );
}

/** Evita que o buscador indexe a página e o navegador mande o endereço (que tem o token) pra outros sites. */
function useProtecaoDePrivacidade() {
  useEffect(() => {
    const metas = [
      Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow' }),
      Object.assign(document.createElement('meta'), { name: 'referrer', content: 'no-referrer' }),
    ];
    metas.forEach(m => document.head.appendChild(m));
    const tituloAntes = document.title;
    document.title = 'Orçamento';
    return () => { metas.forEach(m => m.remove()); document.title = tituloAntes; };
  }, []);
}

function Itens({ itens }: { itens: OrcamentoPublico['orcamento']['itens'] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
      {itens.map((i, n) => (
        <li key={n} style={{ padding: '12px 0', borderTop: n === 0 ? 'none' : `1px solid ${tokens.color.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{i.descricao}</div>
            <div style={{ fontSize: '0.8rem', color: tokens.color.muted, marginTop: 2, overflowWrap: 'anywhere' }}>
              {i.tipo === 'peca' ? 'Peça' : 'Serviço'}{i.marca ? ` · ${i.marca}` : ''}
              {' · '}{i.quantidade.toLocaleString('pt-BR')} × {formatBRL(i.precoUnitario)}
            </div>
            {i.motivo && <div style={{ fontSize: '0.8rem', color: tokens.color.muted, marginTop: 2, overflowWrap: 'anywhere' }}>{i.motivo}</div>}
          </div>
          <div style={{ fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>{formatBRL(i.subtotal)}</div>
        </li>
      ))}
    </ul>
  );
}

function Situacao({ d }: { d: OrcamentoPublico }) {
  const o = d.orcamento;
  switch (d.bloqueio) {
    case 'aprovado':
      return <Aviso tom="ok"><strong>Orçamento aprovado{o.aprovadoPorNome ? ` por ${o.aprovadoPorNome}` : ''}</strong>{o.aprovadoEm ? ` em ${dataBR(o.aprovadoEm)}` : ''}. A oficina já foi avisada e vai dar andamento ao serviço.</Aviso>;
    case 'recusado':
      return <Aviso tom="info"><strong>Orçamento recusado</strong>{o.recusadoEm ? ` em ${dataBR(o.recusadoEm)}` : ''}. Se mudar de ideia, fale com a oficina.</Aviso>;
    case 'vencido':
      return <Aviso tom="crit"><strong>Este orçamento venceu{o.validadeAte ? ` em ${dataBR(o.validadeAte)}` : ''}.</strong> Peça um novo à oficina.</Aviso>;
    case 'substituido':
      return <Aviso tom="warn"><strong>A oficina enviou uma versão mais nova deste orçamento.</strong> Peça o novo link a ela.</Aviso>;
    default:
      return o.validadeAte ? <Aviso tom="warn">Este orçamento vale até <strong>{dataBR(o.validadeAte)}</strong>.</Aviso> : null;
  }
}

export default function OrcamentoPublicoPage({ token }: { token: string }) {
  useProtecaoDePrivacidade();
  const [dados, setDados] = useState<OrcamentoPublico | null>(null);
  const [erro, setErro] = useState<ErroPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<'ver' | 'aprovar' | 'recusar'>('ver');
  const [enviando, setEnviando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [aceito, setAceito] = useState(false);
  const [obs, setObs] = useState('');
  const [motivo, setMotivo] = useState('');
  const [respondeuAgora, setRespondeuAgora] = useState<'aprovado' | 'recusado' | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const d = await apiPublica.obterOrcamento(token);
      setDados(d);
      setErro(null);
      setNome(n => n || d.ordem.clienteNome);
    } catch (e) {
      setErro(e instanceof ErroPublico ? e : new ErroPublico(0, undefined, 'erro'));
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => { void carregar(); }, [carregar]);

  const falhou = (e: unknown) => {
    const err = e instanceof ErroPublico ? e : null;
    setErroAcao(err ? mensagemPublica(err.status, err.codigo) : 'Não foi possível concluir agora.');
    // 409/410: o estado mudou (já respondido, link trocado…) — recarrega pra mostrar a situação real.
    if (err && (err.status === 409 || err.status === 410)) { setModo('ver'); void carregar(); }
  };

  const aprovar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (enviando) return;
    if (nome.trim().length < 2) { setErroAcao('Informe seu nome completo.'); return; }
    if (!aceito) { setErroAcao('Marque a caixa para confirmar que aceita o orçamento.'); return; }
    setEnviando(true); setErroAcao(null);
    try {
      setDados(await apiPublica.aprovar(token, { nome: nome.trim(), aceito: true, observacao: obs.trim() || undefined }));
      setRespondeuAgora('aprovado'); setModo('ver');
    } catch (e) { falhou(e); } finally { setEnviando(false); }
  };

  const recusar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (enviando) return;
    setEnviando(true); setErroAcao(null);
    try {
      setDados(await apiPublica.recusar(token, { motivo: motivo.trim() || undefined }));
      setRespondeuAgora('recusado'); setModo('ver');
    } catch (e) { falhou(e); } finally { setEnviando(false); }
  };

  if (carregando && !dados) {
    return <div style={pagina}><div style={coluna}><div style={{ ...cartao, textAlign: 'center', color: tokens.color.muted }}>Carregando orçamento…</div></div></div>;
  }

  if (!dados) {
    const msg = erro && erro.status !== 0 ? mensagemPublica(erro.status, erro.codigo) : (erro?.message || 'Não foi possível carregar o orçamento.');
    return (
      <div style={pagina}>
        <div style={coluna}>
          <div style={{ ...cartao, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Não foi possível abrir o orçamento</h1>
            <Aviso tom="crit">{msg}</Aviso>
            {erro && (erro.status === 0 || erro.status >= 500 || erro.status === 429) && (
              <button type="button" style={botao(tokens.color.ferrari, '#fff')} onClick={() => void carregar()}>Tentar de novo</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const o = dados.orcamento;
  const v = dados.ordem.veiculo;
  const veiculo = [v.modelo, v.ano, v.cor].filter(Boolean).join(' · ');

  return (
    <div style={pagina}>
      <main style={coluna}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: tokens.fontMono, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.subtle }}>
            {dados.oficina.nome}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Orçamento {dados.ordem.osNum}</h1>
          <div style={{ fontSize: '0.9rem', color: tokens.color.textSecond }}>
            {dados.ordem.clienteNome ? `Para ${dados.ordem.clienteNome} · ` : ''}{veiculo}{v.placa ? ` · ${v.placa}` : ''}
          </div>
        </header>

        {respondeuAgora === 'aprovado' && <Aviso tom="ok"><strong>Obrigado! Sua aprovação foi registrada.</strong> A oficina já foi avisada.</Aviso>}
        {respondeuAgora === 'recusado' && <Aviso tom="info"><strong>Sua resposta foi registrada.</strong> A oficina já foi avisada.</Aviso>}
        {!respondeuAgora && <Situacao d={dados} />}

        <section style={cartao} aria-label="Itens do orçamento">
          <Itens itens={o.itens} />
          <div style={{ borderTop: `2px solid ${tokens.color.border}`, marginTop: 4, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, color: tokens.color.textSecond }}>Total</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: tokens.color.ferrari }}>{formatBRL(o.total)}</span>
          </div>
          {o.observacoes && (
            <div style={{ marginTop: 12, fontSize: '0.88rem', color: tokens.color.textSecond, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{o.observacoes}</div>
          )}
        </section>

        {dados.pdfDisponivel && (
          <a href={apiPublica.urlDoPdf(token)} target="_blank" rel="noopener noreferrer"
            style={{ ...botao('transparent', tokens.color.textSecond, `1px solid ${tokens.color.border}`), textDecoration: 'none', boxSizing: 'border-box', textAlign: 'center', display: 'block', lineHeight: '20px' }}>
            Baixar PDF
          </a>
        )}

        {erroAcao && <Aviso tom="crit">{erroAcao}</Aviso>}

        {dados.podeDecidir && modo === 'ver' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" style={botao(tokens.color.ferrari, '#fff')} onClick={() => { setErroAcao(null); setModo('aprovar'); }}>Aprovar orçamento</button>
            <button type="button" style={botao('transparent', tokens.color.textSecond, `1px solid ${tokens.color.border}`)} onClick={() => { setErroAcao(null); setModo('recusar'); }}>Recusar</button>
          </div>
        )}

        {dados.podeDecidir && modo === 'aprovar' && (
          <form onSubmit={aprovar} style={{ ...cartao, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Confirmar aprovação</h2>
            <div>
              <label style={rotulo} htmlFor="pub-nome">SEU NOME COMPLETO</label>
              <input id="pub-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={120} autoComplete="name" style={campo} />
            </div>
            <div>
              <label style={rotulo} htmlFor="pub-obs">OBSERVAÇÃO PARA A OFICINA (OPCIONAL)</label>
              <textarea id="pub-obs" value={obs} onChange={e => setObs(e.target.value)} maxLength={500} rows={3} style={{ ...campo, resize: 'vertical' }} />
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.92rem', lineHeight: 1.45, cursor: 'pointer' }}>
              <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0 }} />
              <span>Li e aceito este orçamento de <strong>{formatBRL(o.total)}</strong> e autorizo a execução das peças e serviços listados.</span>
            </label>
            <button type="submit" disabled={enviando} style={{ ...botao(tokens.color.ferrari, '#fff'), opacity: enviando ? 0.7 : 1 }}>
              {enviando ? 'Enviando…' : 'Confirmar aprovação'}
            </button>
            <button type="button" disabled={enviando} style={botao('transparent', tokens.color.textSecond, `1px solid ${tokens.color.border}`)} onClick={() => setModo('ver')}>Voltar</button>
          </form>
        )}

        {dados.podeDecidir && modo === 'recusar' && (
          <form onSubmit={recusar} style={{ ...cartao, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Recusar orçamento</h2>
            <div>
              <label style={rotulo} htmlFor="pub-motivo">POR QUÊ? (OPCIONAL)</label>
              <textarea id="pub-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} rows={3}
                placeholder="Ex.: achei o valor alto" style={{ ...campo, resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={enviando} style={{ ...botao(tokens.color.text, '#fff'), opacity: enviando ? 0.7 : 1 }}>
              {enviando ? 'Enviando…' : 'Confirmar recusa'}
            </button>
            <button type="button" disabled={enviando} style={botao('transparent', tokens.color.textSecond, `1px solid ${tokens.color.border}`)} onClick={() => setModo('ver')}>Voltar</button>
          </form>
        )}

        <footer style={{ textAlign: 'center', fontSize: '0.75rem', color: tokens.color.subtle, paddingTop: 4 }}>
          Dúvidas? Fale diretamente com a oficina.
        </footer>
      </main>
    </div>
  );
}

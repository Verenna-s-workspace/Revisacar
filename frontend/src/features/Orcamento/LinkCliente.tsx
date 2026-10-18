import { useCallback, useEffect, useRef, useState } from 'react';
import { tokens } from '../../constants';
import { btnAccent, btnGhost, btnSolid, btnDisabled, pfNote } from '../../components/ui';
import { api } from '../../utils/api';
import { mensagemDoErro } from '../../utils/api_erro';
import { dataBR } from '../../utils/orcamento_utils';
import { linkWhatsApp, mensagemDoWhatsApp, resumoAcessos, telefoneParaWhatsApp, urlDoLink } from '../../utils/orcamento_link_utils';
import type { LinkOrcamento } from '../../types/orcamento_link';

interface Props {
  orcamentoId: string;
  /** ordens.editar: gerar, renovar e desativar. Sem isso só dá pra ver. */
  podeEditar: boolean;
  clienteNome?: string;
  clienteTel?: string;
  /** "Onix ABC1D23" — vai na mensagem do WhatsApp. */
  veiculo?: string;
  /** Recarrega as versões do orçamento (quando o cliente respondeu pelo link). */
  onAtualizar: () => void;
}

const quando = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dataBR(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Link público do orçamento: a oficina copia ou manda por WhatsApp; o cliente aprova ou recusa sem conta. */
export function LinkCliente({ orcamentoId, podeEditar, clienteNome, clienteTel, veiculo, onAtualizar }: Props) {
  const [link, setLink] = useState<LinkOrcamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<'gerando' | 'renovando' | 'desativando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.obterLinkOrcamento(orcamentoId);
      setLink(r?.link ?? null);
      setErro(null);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível consultar o link.'));
    } finally {
      setCarregando(false);
    }
  }, [orcamentoId]);

  useEffect(() => { setLink(null); void carregar(); }, [carregar]);

  const gerar = async (renovar: boolean) => {
    if (renovar && !window.confirm('Gerar um link novo? O link que você já enviou ao cliente deixa de funcionar.')) return;
    setOcupado(renovar ? 'renovando' : 'gerando'); setErro(null);
    try {
      const r = await api.gerarLinkOrcamento(orcamentoId, renovar);
      setLink(r.link);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível gerar o link.'));
    } finally {
      setOcupado(null);
    }
  };

  const desativar = async () => {
    if (!window.confirm('Desativar o link? O cliente não conseguirá mais abrir o orçamento por ele.')) return;
    setOcupado('desativando'); setErro(null);
    try {
      await api.revogarLinkOrcamento(orcamentoId);
      setLink(null);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível desativar o link.'));
    } finally {
      setOcupado(null);
    }
  };

  const url = link ? urlDoLink(link.token, window.location.origin) : '';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      campoRef.current?.select();            // sem permissão de clipboard: deixa selecionado pra copiar na mão
      document.execCommand?.('copy');
    }
    setCopiado(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(false), 3000);
  };

  const mensagem = mensagemDoWhatsApp({ cliente: clienteNome, veiculo, url });
  const temTelefone = telefoneParaWhatsApp(clienteTel) !== null;
  const respondeu = link?.decisao;

  return (
    <section aria-label="Link do orçamento para o cliente" style={{
      border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.lg, background: tokens.color.card,
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <h3 style={{ margin: 0, fontFamily: tokens.fontMono, fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.subtle }}>
        Link para o cliente
      </h3>

      {carregando && !link && !erro && <div style={pfNote}>Verificando…</div>}

      {erro && (
        <div role="alert" style={{ fontSize: '0.82rem', color: tokens.color.crit, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{erro}</span>
          <button type="button" onClick={() => void carregar()} style={btnGhost}>Tentar de novo</button>
        </div>
      )}

      {!carregando && !erro && !link && (
        <>
          <p style={{ margin: 0, fontSize: '0.84rem', color: tokens.color.textSecond, lineHeight: 1.5 }}>
            Gere um link para o cliente ver os valores no celular e aprovar ou recusar — sem precisar de conta nem de aplicativo.
          </p>
          {podeEditar ? (
            <div><button type="button" onClick={() => void gerar(false)} disabled={ocupado !== null} style={ocupado ? btnDisabled : btnAccent}>
              {ocupado === 'gerando' ? 'Gerando…' : 'Gerar link para o cliente'}
            </button></div>
          ) : <span style={pfNote}>Seu cargo pode ver o link, mas não gerá-lo.</span>}
        </>
      )}

      {link && (
        <>
          {respondeu && (
            <div role="status" style={{
              fontSize: '0.84rem', lineHeight: 1.5, borderRadius: tokens.radius.md, padding: '10px 12px',
              color: respondeu === 'aprovado' ? tokens.color.ok : tokens.color.crit,
              background: respondeu === 'aprovado' ? tokens.color.okBg : tokens.color.critBg,
              border: `1px solid ${respondeu === 'aprovado' ? tokens.color.okBorder : tokens.color.critBorder}`,
            }}>
              <strong>O cliente {respondeu === 'aprovado' ? 'aprovou' : 'recusou'} pelo link</strong>
              {link.decisaoNome ? ` (${link.decisaoNome})` : ''}{link.decididoEm ? ` em ${quando(link.decididoEm)}` : ''}.
              <div style={{ marginTop: 8 }}><button type="button" onClick={onAtualizar} style={btnSolid}>Atualizar o orçamento</button></div>
            </div>
          )}

          {!respondeu && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={campoRef} readOnly value={url} aria-label="Link do orçamento" onFocus={e => e.currentTarget.select()}
                  style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '9px 11px', fontFamily: tokens.fontMono, fontSize: '0.74rem',
                    color: tokens.color.text, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, borderRadius: tokens.radius.md }} />
                <button type="button" onClick={() => void copiar()} style={btnSolid}>{copiado ? 'Copiado!' : 'Copiar'}</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={linkWhatsApp(clienteTel, mensagem)} target="_blank" rel="noopener noreferrer"
                  style={{ ...btnAccent, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Enviar por WhatsApp
                </a>
                {!temTelefone && <span style={{ ...pfNote, alignSelf: 'center' }}>Sem telefone válido na OS: o WhatsApp abre pra você escolher o contato.</span>}
              </div>
            </>
          )}

          <div style={pfNote}>
            {resumoAcessos(link, quando)} Vale até {dataBR(link.expiraEm)}.
          </div>

          {podeEditar && !respondeu && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void gerar(true)} disabled={ocupado !== null} style={ocupado ? btnDisabled : btnGhost}>
                {ocupado === 'renovando' ? 'Gerando…' : 'Gerar link novo'}
              </button>
              <button type="button" onClick={() => void desativar()} disabled={ocupado !== null} style={ocupado ? btnDisabled : btnGhost}>
                {ocupado === 'desativando' ? 'Desativando…' : 'Desativar link'}
              </button>
              <button type="button" onClick={() => void carregar()} disabled={carregando} style={btnGhost}>Ver se o cliente abriu</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

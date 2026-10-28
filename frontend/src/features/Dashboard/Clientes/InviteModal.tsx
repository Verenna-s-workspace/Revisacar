import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { useConvites } from '../../../hooks/useConvites';
import { linkDoConvite, situacaoDoConvite, SITUACAO_LABEL, mensagemDeConvite } from '../../../utils/convites';
import type { Convite } from '../../../types/convite';

interface InviteModalProps {
  nomeOficina: string;
  onClose: () => void;
}

const VALIDADES = [1, 3, 7, 15, 30, 90];

const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const botao = (principal: boolean): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: tokens.fontSans,
  border: principal ? 'none' : `1px solid ${tokens.color.border}`,
  background: principal ? tokens.color.ferrari : 'transparent',
  color: principal ? 'white' : tokens.color.text,
});

/** QR do convite desenhado num canvas (conteúdo = link do app, ou só o código se o app não estiver configurado). */
function QrDoConvite({ codigo }: { codigo: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) QRCode.toCanvas(ref.current, linkDoConvite(codigo) ?? codigo, { width: 190, margin: 1 }).catch(() => {});
  }, [codigo]);
  return <canvas ref={ref} aria-label="QR Code do convite" style={{ borderRadius: 10, border: `1px solid ${tokens.color.border}` }} />;
}

export function InviteModal({ nomeOficina, onClose }: InviteModalProps) {
  const { convites, loading, erro, criar, revogar } = useConvites(true);
  const [dias, setDias] = useState(7);
  const [limitar, setLimitar] = useState(false);
  const [maxUsos, setMaxUsos] = useState(1);
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atual, setAtual] = useState<Convite | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const gerar = async () => {
    setGerando(true); setAviso(null);
    try {
      setAtual(await criar({ dias, maxUsos: limitar ? Math.max(1, Math.floor(maxUsos) || 1) : null }));
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível gerar o convite.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(c => (c === chave ? null : c)), 1800);
    } catch {
      setAviso('Não foi possível copiar. Selecione e copie manualmente.');
    }
  };

  const cancelar = async (c: Convite) => {
    if (!window.confirm('Cancelar este convite? Quem ainda não entrou não conseguirá mais usá-lo. Quem já entrou continua na carteira.')) return;
    try { await revogar(c.id); if (atual?.id === c.id) setAtual(null); }
    catch (e) { setAviso(e instanceof Error ? e.message : 'Não foi possível cancelar.'); }
  };

  const link = atual ? linkDoConvite(atual.codigo) : null;

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose} style={{ zIndex: 1300 }}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="dashboard-modal__header">
          <div className="dashboard-modal__title">Convidar cliente para o app</div>
          <button onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, fontSize: '1.3rem', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '4px 22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.82rem', color: tokens.color.muted, lineHeight: 1.55, margin: 0 }}>
            O cliente que já tem conta no app RevisaCar usa o convite para entrar na carteira da oficina,
            cadastrar o veículo e pedir agendamentos. Ao usar o convite ele autoriza a oficina a vê-lo na carteira.
          </p>

          {/* gerar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: 14, background: tokens.color.bg, border: `1px solid ${tokens.color.border}`, borderRadius: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted }}>
              Validade
              <select value={dias} onChange={e => setDias(Number(e.target.value))}
                style={{ padding: '9px 10px', borderRadius: 9, border: `1px solid ${tokens.color.border}`, fontFamily: tokens.fontSans, fontSize: '0.84rem' }}>
                {VALIDADES.map(d => <option key={d} value={d}>{d === 1 ? '1 dia' : `${d} dias`}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: tokens.color.text, paddingBottom: 9 }}>
              <input type="checkbox" checked={limitar} onChange={e => setLimitar(e.target.checked)} />
              Limitar usos
            </label>
            {limitar && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted }}>
                Máx. de usos
                <input type="number" min={1} value={maxUsos} onChange={e => setMaxUsos(Number(e.target.value))}
                  style={{ width: 90, padding: '9px 10px', borderRadius: 9, border: `1px solid ${tokens.color.border}`, fontFamily: tokens.fontSans, fontSize: '0.84rem' }} />
              </label>
            )}
            <button onClick={gerar} disabled={gerando} style={{ ...botao(true), marginLeft: 'auto', opacity: gerando ? 0.6 : 1 }}>
              {gerando ? 'Gerando…' : 'Gerar convite'}
            </button>
          </div>

          {aviso && (
            <div role="alert" style={{ padding: '9px 14px', background: tokens.color.critBg, color: tokens.color.crit, border: `1px solid ${tokens.color.critBorder}`, borderRadius: 10, fontSize: '0.8rem', fontWeight: 600 }}>
              {aviso}
            </div>
          )}

          {/* convite recém-gerado */}
          {atual && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', justifyContent: 'center', padding: 16, border: `1.5px solid ${tokens.color.ferrari}`, borderRadius: 14 }}>
              <QrDoConvite codigo={atual.codigo} />
              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted }}>CÓDIGO</div>
                <code style={{ fontSize: '0.74rem', wordBreak: 'break-all', background: tokens.color.bg, padding: '7px 9px', borderRadius: 8 }}>{atual.codigo}</code>
                <div style={{ fontSize: '0.74rem', color: tokens.color.muted }}>
                  Vale até {fmtData(atual.expiraEm)}{atual.maxUsos != null ? ` · ${atual.maxUsos} uso${atual.maxUsos > 1 ? 's' : ''}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={botao(false)} onClick={() => copiar(atual.codigo, 'codigo')}>{copiado === 'codigo' ? 'Copiado ✓' : 'Copiar código'}</button>
                  {link && <button style={botao(false)} onClick={() => copiar(link, 'link')}>{copiado === 'link' ? 'Copiado ✓' : 'Copiar link'}</button>}
                  <a style={{ ...botao(true), textDecoration: 'none', display: 'inline-block' }} target="_blank" rel="noreferrer"
                     href={`https://wa.me/?text=${encodeURIComponent(mensagemDeConvite(nomeOficina, atual.codigo))}`}>
                    WhatsApp
                  </a>
                </div>
                {!link && (
                  <div style={{ fontSize: '0.7rem', color: tokens.color.warn }}>
                    O endereço do app do cliente não está configurado (VITE_CLIENT_APP_URL): o QR e o WhatsApp levam só o código.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* lista */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: tokens.color.text, marginBottom: 8 }}>Convites gerados</div>
            {loading && <div style={{ fontSize: '0.8rem', color: tokens.color.muted }}>Carregando…</div>}
            {erro && <div style={{ fontSize: '0.8rem', color: tokens.color.crit }}>{erro}</div>}
            {!loading && !erro && convites.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: tokens.color.muted }}>Nenhum convite ainda.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {convites.map(c => {
                const sit = situacaoDoConvite(c);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${tokens.color.border}`, borderRadius: 10, opacity: sit === 'ativo' ? 1 : 0.65 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: tokens.color.text }}>
                        {SITUACAO_LABEL[sit]} · {c.usos}{c.maxUsos != null ? `/${c.maxUsos}` : ''} uso{c.usos === 1 ? '' : 's'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: tokens.color.muted }}>
                        Criado em {fmtData(c.createdAt)}{c.criadoPorNome ? ` por ${c.criadoPorNome}` : ''} · vence {fmtData(c.expiraEm)}
                      </div>
                    </div>
                    {sit === 'ativo' && (
                      <>
                        <button style={botao(false)} onClick={() => setAtual(c)}>Ver QR</button>
                        <button style={{ ...botao(false), color: tokens.color.crit }} onClick={() => cancelar(c)} title="Cancelar convite">
                          <span style={{ display: 'flex' }}>{Icons.trash}</span>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

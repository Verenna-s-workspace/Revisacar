import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Card } from '../Primitives';
import { api } from '../../../utils/api';
import { mensagemDoErro } from '../../../utils/api_erro';
import { usePermissions } from '../../../hooks/usePermissions';
import {
  formatarCodigo, linkDoWhatsApp, mensagemDoWhatsApp, urlDoAcesso,
} from '../../../utils/acesso_equipe_utils';

type Copiado = 'link' | 'codigo' | null;

const botaoSecundario = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'transparent',
  color: tokens.color.text,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 8,
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
} as const;

/**
 * Acesso da equipe: o dono gera um código curto e um link (/f/<código>). Quem abre o link em
 * qualquer computador já cai na lista de nomes da oficina e só digita o PIN — sem precisar saber
 * o CNPJ. Renovar troca o código (o link antigo para de funcionar); desativar apaga o link.
 */
export function AcessoEquipeCard({ isMobile, nomeOficina }: { isMobile: boolean; nomeOficina?: string }) {
  const { can } = usePermissions();
  const podeGerenciar = can('funcionarios.gerenciar');

  const [codigo, setCodigo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState<Copiado>(null);
  const [confirmando, setConfirmando] = useState<'renovar' | 'desativar' | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    api.obterAcessoEquipe()
      .then((r: { codigo: string | null }) => setCodigo(r?.codigo ?? null))
      .catch((e: unknown) => setErro(mensagemDoErro(e, 'Não foi possível carregar o acesso da equipe.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (podeGerenciar) carregar();
  }, [podeGerenciar, carregar]);

  // Esconder a seção é só UX — quem barra é o funcionarios.gerenciar no backend.
  if (!podeGerenciar) return null;

  const url = codigo ? urlDoAcesso(codigo, window.location.origin) : '';

  const agir = async (acao: () => Promise<{ codigo?: string | null } | null>) => {
    setOcupado(true);
    setErro('');
    setConfirmando(null);
    try {
      const r = await acao();
      setCodigo(r?.codigo ?? null);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível concluir. Tente de novo.'));
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async (o: Exclude<Copiado, null>, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(o);
      window.setTimeout(() => setCopiado(atual => (atual === o ? null : atual)), 2000);
    } catch {
      setErro('Seu navegador não deixou copiar. Selecione o texto e copie manualmente.');
    }
  };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--color-ferrari)', display: 'flex' }}>{Icons.user}</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: tokens.color.text }}>Acesso da equipe</div>
            <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>
              Link para o funcionário entrar com o PIN em qualquer computador
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {erro && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', background: 'var(--color-crit-bg)',
            color: 'var(--color-crit)', border: '1px solid var(--color-crit-border)',
            borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
          }}>
            {erro}
          </div>
        )}

        {loading ? (
          <div style={{ color: tokens.color.muted, fontSize: '0.85rem' }}>Carregando…</div>
        ) : !codigo ? (
          <div>
            <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: tokens.color.muted, lineHeight: 1.45 }}>
              Gere o link e mande para a equipe (WhatsApp, por exemplo). Quem abrir já vê a lista de nomes
              da oficina e só digita o PIN, sem precisar saber o CNPJ.
            </p>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => agir(() => api.gerarAcessoEquipe(false))}
              style={{
                padding: '9px 16px', background: 'var(--color-ferrari)', color: 'white', border: 'none',
                borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)', width: isMobile ? '100%' : 'auto',
                opacity: ocupado ? 0.7 : 1,
              }}
            >
              {ocupado ? 'Gerando…' : 'Gerar link de acesso'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, marginBottom: 6, letterSpacing: '0.04em' }}>
                CÓDIGO DA OFICINA
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '1.5rem',
                  fontWeight: 800, letterSpacing: '0.12em', color: tokens.color.text,
                }}>
                  {formatarCodigo(codigo)}
                </span>
                <button type="button" style={botaoSecundario} onClick={() => copiar('codigo', formatarCodigo(codigo))}>
                  {copiado === 'codigo' ? <>{Icons.check} Copiado</> : 'Copiar código'}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.color.muted, marginBottom: 6, letterSpacing: '0.04em' }}>
                LINK
              </div>
              <div style={{
                padding: '10px 12px', border: `1px solid ${tokens.color.border}`, borderRadius: 8,
                background: tokens.color.surfaceHigh, fontSize: '0.8rem', color: tokens.color.text,
                wordBreak: 'break-all', userSelect: 'all',
              }}>
                {url}
              </div>
              <div style={{
                display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap',
                flexDirection: isMobile ? 'column' : 'row',
              }}>
                <button type="button" style={botaoSecundario} onClick={() => copiar('link', url)}>
                  {copiado === 'link' ? <>{Icons.check} Copiado</> : 'Copiar link'}
                </button>
                <a
                  className="tap-min"
                  style={botaoSecundario}
                  href={linkDoWhatsApp(mensagemDoWhatsApp({ url, oficina: nomeOficina }))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Enviar por WhatsApp
                </a>
              </div>
            </div>

            <div style={{
              paddingTop: 14, borderTop: `1px solid ${tokens.color.border}`,
              display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            }}>
              {confirmando ? (
                <>
                  <span style={{ fontSize: '0.8rem', color: tokens.color.text, fontWeight: 600 }}>
                    {confirmando === 'renovar'
                      ? 'O link e o código atuais deixam de funcionar. Continuar?'
                      : 'O link deixa de funcionar. Quem já entrou neste aparelho continua entrando. Continuar?'}
                  </span>
                  <button
                    type="button"
                    disabled={ocupado}
                    style={{ ...botaoSecundario, background: 'var(--color-ferrari)', color: 'white', border: 'none' }}
                    onClick={() => agir(() => (confirmando === 'renovar'
                      ? api.gerarAcessoEquipe(true)
                      : api.desativarAcessoEquipe().then(() => ({ codigo: null }))))}
                  >
                    Sim, continuar
                  </button>
                  <button type="button" style={botaoSecundario} onClick={() => setConfirmando(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button type="button" style={botaoSecundario} disabled={ocupado} onClick={() => setConfirmando('renovar')}>
                    Gerar novo código
                  </button>
                  <button type="button" style={botaoSecundario} disabled={ocupado} onClick={() => setConfirmando('desativar')}>
                    Desativar link
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

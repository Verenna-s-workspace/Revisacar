import { useMemo, useState } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { Skeleton } from '../Primitives';
import { Sidebar, MobileNav, MobileTopbar } from '../Navigation';
import { useAlertas } from '../../../hooks/useAlertas';
import { maisGrave } from '../../../utils/alertas';
import type { AcaoAlerta, AlertaItem, SeveridadeAlerta } from '../../../utils/alertas';
import type { NavPage } from '../../../types/dashboard';

interface AlertasPageProps {
  onNav: (p: NavPage) => void;
  isMobile: boolean;
  onNewOS?: () => void;
  /** Executa o destino de um alerta (abrir tela, já com busca, ou abrir uma OS). */
  onAcao: (acao: AcaoAlerta) => void;
}

type Filtro = 'todos' | SeveridadeAlerta;

const CORES: Record<SeveridadeAlerta, { cor: string; bg: string; borda: string; icone: JSX.Element; rotulo: string }> = {
  crit: { cor: tokens.color.crit, bg: tokens.color.critBg, borda: tokens.color.critBorder, icone: Icons.alert, rotulo: 'Urgente' },
  warn: { cor: tokens.color.warn, bg: tokens.color.warnBg, borda: tokens.color.warnBorder, icone: Icons.clock, rotulo: 'Atenção' },
  info: { cor: tokens.color.ok, bg: tokens.color.okBg, borda: tokens.color.okBorder, icone: Icons.cal, rotulo: 'Informativo' },
};

const botaoPrimario: React.CSSProperties = {
  padding: '8px 14px', background: tokens.color.ferrari, color: 'white', border: 'none', borderRadius: 8,
  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: tokens.fontSans,
};
const botaoSecundario: React.CSSProperties = {
  padding: '8px 12px', background: 'transparent', color: tokens.color.textSecond, border: `1px solid ${tokens.color.border}`,
  borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: tokens.fontSans,
};

function LinhaAlerta({ alerta, isMobile, onAcao }: { alerta: AlertaItem; isMobile: boolean; onAcao: (a: AcaoAlerta) => void }) {
  const c = CORES[alerta.severidade];
  return (
    <div style={{
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center',
      justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderRadius: 10, background: c.bg, border: `1px solid ${c.borda}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <span style={{ color: c.cor, flexShrink: 0, marginTop: 2, display: 'flex' }} aria-hidden="true">{c.icone}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: tokens.color.text, overflowWrap: 'anywhere' }}>{alerta.titulo}</div>
          {alerta.detalhe && <div style={{ fontSize: '0.76rem', color: tokens.color.textSecond, marginTop: 2, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{alerta.detalhe}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {alerta.acaoSecundaria && (
          <button type="button" style={botaoSecundario} onClick={() => onAcao(alerta.acaoSecundaria!)}>{alerta.acaoSecundaria.rotulo}</button>
        )}
        <button type="button" style={botaoPrimario} onClick={() => onAcao(alerta.acao)}>
          {alerta.acao.rotulo} <span style={{ display: 'flex' }}>{Icons.arrow}</span>
        </button>
      </div>
    </div>
  );
}

export function AlertasPage({ onNav, isMobile, onNewOS, onAcao }: AlertasPageProps) {
  const { grupos, alertas, loading, erro, avisos, recarregar } = useAlertas();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const qtd = useMemo(() => ({
    todos: alertas.length,
    crit: alertas.filter(a => a.severidade === 'crit').length,
    warn: alertas.filter(a => a.severidade === 'warn').length,
    info: alertas.filter(a => a.severidade === 'info').length,
  }), [alertas]);

  const gruposVisiveis = useMemo(
    () => grupos
      .map(g => ({ ...g, itens: filtro === 'todos' ? g.itens : g.itens.filter(i => i.severidade === filtro) }))
      .filter(g => g.itens.length > 0),
    [grupos, filtro],
  );

  const filtros: { id: Filtro; rotulo: string; n: number }[] = [
    { id: 'todos', rotulo: 'Todos', n: qtd.todos },
    { id: 'crit', rotulo: 'Urgentes', n: qtd.crit },
    { id: 'warn', rotulo: 'Atenção', n: qtd.warn },
    ...(qtd.info > 0 ? [{ id: 'info' as const, rotulo: 'Informativos', n: qtd.info }] : []),
  ];

  const content = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: tokens.color.bg }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '14px 16px' : '16px 28px',
        background: 'white', borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0,
      }}>
        {isMobile && (
          <button onClick={() => onNav('dashboard')} aria-label="Voltar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 4 }}>
            {Icons.chevL}
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.3rem', color: tokens.color.text, margin: 0 }}>Alertas</h2>
          <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>
            O que precisa da sua atenção agora, com atalho pra resolver.
          </p>
        </div>
        <button type="button" onClick={recarregar} disabled={loading} style={{ ...botaoSecundario, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '12px 12px 32px' : '18px 28px 36px',
        display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980, width: '100%', boxSizing: 'border-box', margin: '0 auto',
      }}>
        {erro && (
          <div role="alert" style={{
            padding: '10px 16px', background: tokens.color.critBg, color: tokens.color.crit, border: `1px solid ${tokens.color.critBorder}`,
            borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span>{erro}</span>
            <button type="button" onClick={recarregar} style={botaoSecundario}>Tentar de novo</button>
          </div>
        )}

        {!loading && avisos.map(a => (
          <div key={a} role="status" style={{
            padding: '10px 16px', background: tokens.color.warnBg, color: tokens.color.warn, border: `1px solid ${tokens.color.warnBorder}`,
            borderRadius: 10, fontSize: '0.8rem', fontWeight: 600,
          }}>{a}</div>
        ))}

        {!erro && (loading || alertas.length > 0) && (
          <div role="group" aria-label="Filtrar por urgência" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filtros.map(f => {
              const ativo = filtro === f.id;
              return (
                <button key={f.id} type="button" aria-pressed={ativo} onClick={() => setFiltro(f.id)} style={{
                  padding: '7px 14px', borderRadius: 99, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: tokens.fontSans,
                  border: `1px solid ${ativo ? tokens.color.ferrari : tokens.color.border}`,
                  background: ativo ? tokens.color.ferrari : 'white', color: ativo ? 'white' : tokens.color.textSecond,
                }}>
                  {f.rotulo} · {loading ? '–' : f.n}
                </button>
              );
            })}
          </div>
        )}

        {loading && alertas.length === 0 && (
          <>
            <Skeleton h={120} r={14} />
            <Skeleton h={120} r={14} />
          </>
        )}

        {!loading && !erro && alertas.length === 0 && (
          <div style={{
            padding: '36px 20px', borderRadius: 14, background: tokens.color.okBg, border: `1px solid ${tokens.color.okBorder}`,
            textAlign: 'center', color: tokens.color.ok,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{Icons.check}</div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Tudo em dia</div>
            <div style={{ fontSize: '0.82rem', marginTop: 4 }}>Nenhum alerta no momento.</div>
          </div>
        )}

        {gruposVisiveis.map(g => {
          const c = CORES[maisGrave(g.itens)];
          return (
            <section key={g.fonte.id} aria-label={g.fonte.titulo} style={{
              background: 'white', border: `1px solid ${tokens.color.border}`, borderRadius: 14, padding: isMobile ? '14px 12px' : '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: tokens.color.text }}>
                  {g.fonte.titulo}
                </h3>
                <span style={{
                  minWidth: 22, height: 22, padding: '0 7px', borderRadius: 99, background: c.cor, color: 'white', fontSize: '0.72rem',
                  fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{g.itens.length}</span>
                <span style={{ fontSize: '0.7rem', color: tokens.color.muted, marginLeft: 'auto' }}>{c.rotulo}</span>
              </div>
              {g.itens.map(a => <LinhaAlerta key={a.id} alerta={a} isMobile={isMobile} onAcao={onAcao} />)}
            </section>
          );
        })}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="alertas" onNav={onNav} />
        {content}
        <MobileNav active="alertas" onNav={onNav} onNewOS={onNewOS ?? (() => {})} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="alertas" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{content}</main>
    </div>
  );
}

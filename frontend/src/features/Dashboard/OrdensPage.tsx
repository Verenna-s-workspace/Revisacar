import { mensagemDoErro } from '../../utils/api_erro';
import { useState, useEffect } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { StatusBadge, Skeleton } from './Primitives';
import { Sidebar, MobileNav, MobileTopbar } from './Navigation';
import { api } from '../../utils/api';
import { Input } from '../../components/inputs/input';
import { formatCpfCnpj, formatPhoneBR, formatKm } from '../../components/inputs/masks';
import type { OrdemRow, NavPage } from '../../types/dashboard';
import { OrdensDesktop } from './Ordens/OrdensDesktop';
import { OrdensMobile } from './Ordens/OrdensMobile';
import type { FiltroStatus } from './Ordens/ordensUtils';

// ── Date formatter ────────────────────────────────────────────────────────────

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ', ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── OSRow ─────────────────────────────────────────────────────────────────────

export function OSRow({ ordem, onClick }: { ordem: OrdemRow; onClick: () => void }) {
  // A margem negativa (pro fundo do hover encostar na borda do card) vem do
  // CSS: era -20px fixo e, na tela de Ordens (padding 14px), gerava rolagem
  // horizontal no celular. role/tabIndex: a linha abre a OS também pelo teclado.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir OS ${ordem.os_num} de ${ordem.cliente}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="dashboard-order-row"
    >
      <div className="dashboard-order-row__icon" style={{ width: 52, height: 40, borderRadius: 8, background: tokens.color.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted, flexShrink: 0 }}>
        {Icons.car}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: tokens.color.text }}>OS #{ordem.os_num}</div>
        <div style={{ fontSize: '0.75rem', color: tokens.color.muted, marginTop: 1 }}>
          Cliente: {ordem.cliente}
        </div>
        {/* A lista de OS não traz os serviços: aqui é o veículo (antes vinha rotulado como "Serviço"). */}
        <div style={{ fontSize: '0.75rem', color: tokens.color.subtle, marginTop: 1 }}>
          Veículo: {[ordem.modelo, ordem.placa].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="dashboard-order-row__status">
        <StatusBadge status={ordem.status} />
        <span style={{ fontSize: '0.75rem', color: tokens.color.muted }}>{formatDate(ordem.created_at)}</span>
      </div>
    </div>
  );
}

// ── OSModal ───────────────────────────────────────────────────────────────────

interface OSModalProps {
  ordem: OrdemRow;
  onClose: () => void;
  onEdit: () => void;
}

export function OSModal({ ordem, onClose, onEdit }: OSModalProps) {
  const raw = ordem.payload;
  const pl = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw ?? {});
  const h = pl.os_header ?? {}, cli = pl.cliente ?? {}, vei = pl.veiculo ?? {}, tec = pl.tecnico ?? {};

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const Field = ({ label, val }: { label: string; val: string }) => (
    <div>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.subtle }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.color.text, marginTop: 1 }}>{val || '—'}</div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 18, height: 2, background: '#CC1400', borderRadius: 1, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted }}>{title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>{children}</div>
    </div>
  );

  return (
    <div className="dashboard-modal-backdrop" onClick={onClose}>
      <div className="dashboard-modal" onClick={e => e.stopPropagation()}>
        <div className="dashboard-modal__header">
          <div>
            <div className="dashboard-modal__title">OS #{ordem.os_num}</div>
            <div className="dashboard-modal__subtitle">
              {new Date(ordem.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="dashboard-modal__actions">
            <StatusBadge status={ordem.status} />
            <button
              onClick={onEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, background: '#CC1400', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {Icons.edit} Editar
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="dashboard-button--close tap-area"
              style={{ width: 32, height: 32, border: `1px solid ${tokens.color.border}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', color: tokens.color.muted, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="dashboard-modal__body">
          <Section title="Identificação">
            <Field label="Nº OS" val={h.os_num || ordem.os_num} />
            <Field label="Data" val={h.os_date ? h.os_date.split('-').reverse().join('/') : ''} />
            <Field label="Hora" val={h.os_time} />
            <Field label="KM" val={formatKm(h.os_km)} />
          </Section>
          <Section title="Cliente">
            <Field label="Nome" val={cli.nome || ordem.cliente} />
            <Field label="Documento" val={formatCpfCnpj(cli.doc)} />
            <Field label="Telefone" val={formatPhoneBR(cli.tel)} />
            <Field label="E-mail" val={cli.email} />
          </Section>
          <Section title="Veículo">
            <Field label="Placa" val={vei.placa || ordem.placa} />
            <Field label="Modelo" val={vei.modelo || ordem.modelo} />
            <Field label="Ano" val={vei.ano} />
            <Field label="Cor" val={vei.cor} />
            <Field label="Combustível" val={vei.combustivel} />
          </Section>
          {tec.nome && (
            <Section title="Técnico">
              <Field label="Nome" val={tec.nome} />
              <Field label="Registro" val={tec.registro} />
              <Field label="Data Saída" val={tec.data_saida ? tec.data_saida.split('-').reverse().join('/') : ''} />
              <Field label="KM Saída" val={formatKm(tec.km_saida)} />
              {tec.parecer_geral && (
                <div className="dashboard-modal__remark" style={{ gridColumn: 'span 2' }}>
                  <div className="dashboard-modal__remark-label">Parecer Geral</div>
                  <div className="dashboard-modal__remark-text">{tec.parecer_geral}</div>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OrdensPage ────────────────────────────────────────────────────────────────
// Desktop e celular: telas redesenhadas em ./Ordens (OrdensDesktop / OrdensMobile).
// OSRow continua exportado porque outras telas ainda usam.

interface OrdensPageProps {
  ordens: OrdemRow[];
  loading: boolean;
  onNewOS: () => void;
  onLoadOS?: (id: string) => void;
  onNav: (p: NavPage) => void;
  isMobile: boolean;
}

export function OrdensPage({ ordens, loading, onNewOS, onLoadOS, onNav, isMobile }: OrdensPageProps) {
  const [filter, setFilter] = useState<FiltroStatus>('todas');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<OrdemRow | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const handleDel = async (id: string) => {
    if (!window.confirm('Excluir esta OS permanentemente?')) return;
    setDel(id);
    try { await api.deletarOrdem(id); window.location.reload(); } catch (e) { setDel(null); window.alert(mensagemDoErro(e, 'Não foi possível excluir a OS. Tente de novo.')); }
  };

  const modal = sel && (
    <OSModal ordem={sel} onClose={() => setSel(null)} onEdit={() => { onLoadOS?.(sel.id); setSel(null); }} />
  );

  if (!isMobile) {
    return (
      <div style={{ display: 'flex', minHeight: '100dvh' }}>
        <Sidebar active="ordens" onNav={onNav} onNewOS={onNewOS} />
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
          <OrdensDesktop
            ordens={ordens}
            loading={loading}
            filtro={filter}
            onFiltro={setFilter}
            busca={search}
            onBusca={setSearch}
            onNewOS={onNewOS}
            onAbrir={setSel}
            onEditar={id => onLoadOS?.(id)}
            onExcluir={handleDel}
            excluindoId={del}
          />
        </main>
        {modal}
      </div>
    );
  }

  // ── Celular: lista redesenhada em ./Ordens (OrdensMobile) ──
  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
      <MobileTopbar active="ordens" onNav={onNav} />
      <OrdensMobile
        ordens={ordens}
        loading={loading}
        onAbrir={setSel}
        onEditar={id => onLoadOS?.(id)}
        onExcluir={handleDel}
        excluindoId={del}
      />
      {modal}
      <MobileNav active="ordens" onNav={onNav} onNewOS={onNewOS} />
    </div>
  );
}
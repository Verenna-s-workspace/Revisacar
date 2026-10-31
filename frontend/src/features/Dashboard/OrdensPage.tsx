import { useState, useEffect } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { StatusBadge, Skeleton } from './Primitives';
import { Sidebar, MobileNav, MobileTopbar } from './Navigation';
import { api } from '../../utils/api';
import { Input } from '../../components/inputs/input';
import type { OrdemRow, NavPage } from '../../types/dashboard';

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

// ── TableRow (desktop) ────────────────────────────────────────────────────────

interface TableRowProps {
  o: OrdemRow;
  isLast: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function TableRow({ o, isLast, onSelect, onEdit, onDelete, deleting }: TableRowProps) {
  const [hov, setHov] = useState(false);
  const d = new Date(o.created_at);
  return (
    <div
      className="ordens-tabela__linha"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '13px 16px',
        background: hov ? tokens.color.bg : 'white',
        border: `1px solid ${tokens.color.border}`,
        borderTop: 'none',
        alignItems: 'center',
        borderRadius: isLast ? '0 0 10px 10px' : 0,
        transition: 'background 0.1s',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Abrir OS ${o.os_num}`}
        style={{ fontWeight: 700, fontSize: '0.875rem', color: '#CC1400', cursor: 'pointer', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
      >
        #{o.os_num}
      </button>
      {/* A placa embaixo do cliente só aparece quando a coluna Placa some (< 1280px) */}
      <div onClick={onSelect} style={{ cursor: 'pointer', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: tokens.color.text, overflowWrap: 'anywhere' }}>{o.cliente}</div>
        <div className="ordens-tabela__placa-sub" style={{ fontSize: '0.75rem', color: tokens.color.muted, fontFamily: "'DM Mono',monospace" }}>{o.placa}</div>
      </div>
      <span className="ordens-tabela__col-placa" style={{ fontSize: '0.82rem', color: tokens.color.muted, fontFamily: "'DM Mono',monospace" }}>{o.placa}</span>
      <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond, minWidth: 0, overflowWrap: 'anywhere' }}>{o.modelo || '—'}</span>
      <StatusBadge status={o.status} />
      <div>
        <div style={{ fontSize: '0.8rem', color: tokens.color.text }}>
          {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </div>
        <div style={{ fontSize: '0.75rem', color: tokens.color.muted }}>
          {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="tap-area"
          onClick={onEdit} title="Editar" aria-label={`Editar OS ${o.os_num}`}
          style={{ width: 34, height: 34, borderRadius: 7, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
        >
          {Icons.edit}
        </button>
        <button className="tap-area"
          onClick={onDelete} disabled={deleting} title="Excluir" aria-label={`Excluir OS ${o.os_num}`}
          style={{ width: 34, height: 34, borderRadius: 7, border: '1px solid rgba(204,20,0,0.2)', background: 'rgba(204,20,0,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CC1400', opacity: deleting ? 0.5 : 1 }}
        >
          {Icons.trash}
        </button>
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
            <Field label="KM" val={h.os_km} />
          </Section>
          <Section title="Cliente">
            <Field label="Nome" val={cli.nome || ordem.cliente} />
            <Field label="Documento" val={cli.doc} />
            <Field label="Telefone" val={cli.tel} />
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
              <Field label="KM Saída" val={tec.km_saida} />
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





type FilterStatus = 'todas' | 'andamento' | 'aguardando' | 'finalizada' | 'recusada';

const FILTER_LABELS: Record<FilterStatus, string> = {
  todas: 'Todas', andamento: 'Em andamento', aguardando: 'Aguardando', finalizada: 'Concluídas', recusada: 'Recusadas',
};

// Cada filtro agrupa os status que fazem sentido juntos pra quem olha a lista.
const FILTER_STATUS: Record<Exclude<FilterStatus, 'todas'>, readonly string[]> = {
  andamento: ['rascunho', 'em_orcamento', 'aprovada', 'em_execucao'],
  aguardando: ['aguardando', 'pendente_aprovacao'],
  finalizada: ['finalizada'],
  recusada: ['recusada'],
};
const FILTROS: FilterStatus[] = ['todas', 'andamento', 'aguardando', 'finalizada', 'recusada'];
const noFiltro = (status: string, f: FilterStatus) => f === 'todas' || FILTER_STATUS[f].includes(status);

interface OrdensPageProps {
  ordens: OrdemRow[];
  loading: boolean;
  onNewOS: () => void;
  onLoadOS?: (id: string) => void;
  onNav: (p: NavPage) => void;
  isMobile: boolean;
}

export function OrdensPage({ ordens, loading, onNewOS, onLoadOS, onNav, isMobile }: OrdensPageProps) {
  const [filter, setFilter] = useState<FilterStatus>('todas');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<OrdemRow | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const filtered = ordens.filter(o => {
    if (!noFiltro(o.status, filter)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return o.os_num.includes(q) || o.cliente.toLowerCase().includes(q) ||
      o.placa.toLowerCase().includes(q) || (o.modelo ?? '').toLowerCase().includes(q);
  });

  const counts = Object.fromEntries(
    FILTROS.map(f => [f, ordens.filter(o => noFiltro(o.status, f)).length])
  ) as Record<FilterStatus, number>;

  const handleDel = async (id: string) => {
    if (!window.confirm('Excluir esta OS permanentemente?')) return;
    setDel(id);
    try { await api.deletarOrdem(id); window.location.reload(); } catch { setDel(null); }
  };

  const content = (
    <div style={{ flex: 1, minWidth: 0, background: tokens.color.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: 'var(--color-surface)', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <button onClick={() => onNav('dashboard')} aria-label="Voltar para a Visão Geral" className="dashboard-back-button">
              {Icons.chevL}
            </button>
          )}
          <div>
            <h2 style={{ fontWeight: 800, fontSize: isMobile ? '1.05rem' : '1.25rem', color: tokens.color.text, margin: 0 }}>Ordens de Serviço</h2>
            <p style={{ fontSize: '0.75rem', color: tokens.color.muted, margin: 0 }}>{ordens.length} ordens no total</p>
          </div>
        </div>
        <button
          onClick={onNewOS}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', minHeight: isMobile ? 44 : undefined, background: '#CC1400', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}
        >
          Nova OS
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: 10, padding: isMobile ? '12px 14px' : '14px 28px', background: 'var(--color-surface)', borderBottom: `1px solid ${tokens.color.border}`, flexDirection: isMobile ? 'column' : 'row', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
        {/* Celular: uma linha que desliza (antes quebrava em 3 linhas, ~150px).
            minWidth 0 + coluna sem wrap: senão a faixa assume a largura de todos
            os filtros e a página inteira fica mais larga que a tela. */}
        <div className={isMobile ? 'faixa-rolavel' : undefined} style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: 0 }}>
          {FILTROS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              style={{ padding: '6px 13px', minHeight: isMobile ? 44 : undefined, flexShrink: 0, whiteSpace: 'nowrap', borderRadius: 8, border: `1.5px solid ${filter === f ? '#CC1400' : tokens.color.border}`, background: filter === f ? 'rgba(204,20,0,0.06)' : 'transparent', color: filter === f ? '#CC1400' : tokens.color.muted, fontSize: '0.8rem', fontWeight: filter === f ? 600 : 400, cursor: 'pointer' }}
            >
              {FILTER_LABELS[f]} <span style={{ opacity: 0.55, fontSize: '0.75rem' }}>({counts[f]})</span>
            </button>
          ))}
        </div>
        <div style={{ flex: isMobile ? 1 : undefined, minWidth: isMobile ? 0 : 220 }}>
          <Input
            name="busca_ordens"
            type="search"
            value={search}
            onChangeValue={setSearch}
            placeholder="Buscar OS, cliente, placa..."
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: isMobile ? '0 14px 20px' : '20px 28px', flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={68} r={10} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: tokens.color.muted }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 14, opacity: 0.25 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma ordem encontrada</div>
            <div style={{ fontSize: '0.84rem' }}>Ajuste os filtros ou crie uma nova OS</div>
          </div>
        ) : isMobile ? (
          <div>{filtered.map(o => <OSRow key={o.id} ordem={o} onClick={() => setSel(o)} />)}</div>
        ) : (
          <div>
            <div className="ordens-tabela__linha" style={{ padding: '9px 16px', background: tokens.color.surfaceHigh, borderRadius: '10px 10px 0 0', border: `1px solid ${tokens.color.border}`, borderBottom: 'none' }}>
              {['Nº OS', 'Cliente', 'Placa', 'Modelo', 'Status', 'Data', ''].map(h => (
                <span key={h} className={h === 'Placa' ? 'ordens-tabela__col-placa' : undefined} style={{ fontSize: '0.75rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
              ))}
            </div>
            {filtered.map((o, i) => (
              <TableRow
                key={o.id} o={o} isLast={i === filtered.length - 1}
                onSelect={() => setSel(o)}
                onEdit={() => onLoadOS?.(o.id)}
                onDelete={() => handleDel(o.id)}
                deleting={del === o.id}
              />
            ))}
          </div>
        )}
      </div>

      {sel && <OSModal ordem={sel} onClose={() => setSel(null)} onEdit={() => { onLoadOS?.(sel.id); setSel(null); }} />}
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ background: tokens.color.bg, minHeight: '100dvh', paddingBottom: 'var(--mobile-bottom-nav-h)', display: 'flex', flexDirection: 'column' }}>
        <MobileTopbar active="ordens" onNav={onNav} />
        {content}
        <MobileNav active="ordens" onNav={onNav} onNewOS={onNewOS} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      <Sidebar active="ordens" onNav={onNav} onNewOS={onNewOS} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{content}</main>
    </div>
  );
}

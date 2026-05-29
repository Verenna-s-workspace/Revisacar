import { useState, useEffect } from 'react';
import { tokens } from '../../constants';
import { Icons } from './Icons';
import { StatusBadge } from './Primitives';
import { api } from '../../utils/api';
import type { OrdemRow } from '../../types/dashboard';

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
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="dashboard-order-row"
      style={{
        background: hov ? tokens.color.bg : 'transparent',
        margin: '0 -20px',
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      <div style={{ width: 52, height: 40, borderRadius: 8, background: tokens.color.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted, flexShrink: 0 }}>
        {Icons.car}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: tokens.color.text }}>OS #{ordem.os_num}</div>
        <div style={{ fontSize: '0.74rem', color: tokens.color.muted, marginTop: 1 }}>
          Cliente: {ordem.cliente} · Veículo: {ordem.placa}
        </div>
        <div style={{ fontSize: '0.7rem', color: tokens.color.subtle, marginTop: 1 }}>
          Serviço: {ordem.modelo || 'Inspeção geral'}
        </div>
      </div>
      <div className="dashboard-order-row__status">
        <StatusBadge status={ordem.status} />
        <span style={{ fontSize: '0.68rem', color: tokens.color.muted }}>{formatDate(ordem.created_at)}</span>
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

export function TableRow({ o, isLast, onSelect, onEdit, onDelete, deleting }: TableRowProps) {
  const [hov, setHov] = useState(false);
  const d = new Date(o.created_at);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr 110px 140px 150px 120px 80px',
        gap: '0 10px',
        padding: '13px 16px',
        background: hov ? tokens.color.bg : 'white',
        border: `1px solid ${tokens.color.border}`,
        borderTop: 'none',
        alignItems: 'center',
        borderRadius: isLast ? '0 0 10px 10px' : 0,
        transition: 'background 0.1s',
      }}
    >
      <span
        style={{ fontWeight: 700, fontSize: '0.875rem', color: '#CC1400', cursor: 'pointer' }}
        onClick={onSelect}
      >
        #{o.os_num}
      </span>
      <div onClick={onSelect} style={{ cursor: 'pointer' }}>
        <div style={{ fontWeight: 600, fontSize: '0.84rem', color: tokens.color.text }}>{o.cliente}</div>
        <div style={{ fontSize: '0.7rem', color: tokens.color.muted }}>{o.placa}</div>
      </div>
      <span style={{ fontSize: '0.82rem', color: tokens.color.muted, fontFamily: "'DM Mono',monospace" }}>{o.placa}</span>
      <span style={{ fontSize: '0.82rem', color: tokens.color.textSecond }}>{o.modelo || '—'}</span>
      <StatusBadge status={o.status} />
      <div>
        <div style={{ fontSize: '0.8rem', color: tokens.color.text }}>
          {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </div>
        <div style={{ fontSize: '0.7rem', color: tokens.color.muted }}>
          {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onEdit} title="Editar"
          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${tokens.color.border}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.color.muted }}
        >
          {Icons.edit}
        </button>
        <button
          onClick={onDelete} disabled={deleting} title="Excluir"
          style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(204,20,0,0.2)', background: 'rgba(204,20,0,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#CC1400', opacity: deleting ? 0.5 : 1 }}
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
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: tokens.color.subtle }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: tokens.color.text, marginTop: 1 }}>{val || '—'}</div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 18, height: 2, background: '#CC1400', borderRadius: 1, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted }}>{title}</span>
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
              className="dashboard-button--close"
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

import { Skeleton } from './Primitives';
import { Sidebar, MobileNav } from './Navigation';
import type { NavPage } from '../../types/dashboard';

type FilterStatus = 'todas' | 'rascunho' | 'finalizada' | 'aguardando';

const FILTER_LABELS: Record<FilterStatus, string> = {
  todas: 'Todas', rascunho: 'Em andamento', finalizada: 'Finalizadas', aguardando: 'Aguardando',
};

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
    if (filter !== 'todas' && o.status !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return o.os_num.includes(q) || o.cliente.toLowerCase().includes(q) ||
      o.placa.toLowerCase().includes(q) || (o.modelo ?? '').toLowerCase().includes(q);
  });

  const counts = {
    todas: ordens.length,
    rascunho: ordens.filter(o => o.status === 'rascunho').length,
    finalizada: ordens.filter(o => o.status === 'finalizada').length,
    aguardando: ordens.filter(o => o.status === 'aguardando').length,
  };

  const handleDel = async (id: string) => {
    if (!window.confirm('Excluir esta OS permanentemente?')) return;
    setDel(id);
    try { await api.deletarOrdem(id); window.location.reload(); } catch { setDel(null); }
  };

  const content = (
    <div style={{ flex: 1, minWidth: 0, background: tokens.color.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 16px' : '18px 28px', background: 'white', borderBottom: `1px solid ${tokens.color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMobile && (
            <button onClick={() => onNav('dashboard')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: tokens.color.muted, display: 'flex', padding: 4 }}>
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
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#CC1400', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <span style={{ display: 'flex' }}>{Icons.plus}</span> Nova OS
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: 10, padding: isMobile ? '12px 14px' : '14px 28px', background: 'white', borderBottom: `1px solid ${tokens.color.border}`, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['todas', 'rascunho', 'finalizada', 'aguardando'] as FilterStatus[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: '6px 13px', borderRadius: 8, border: `1.5px solid ${filter === f ? '#CC1400' : tokens.color.border}`, background: filter === f ? 'rgba(204,20,0,0.06)' : 'transparent', color: filter === f ? '#CC1400' : tokens.color.muted, fontSize: '0.8rem', fontWeight: filter === f ? 600 : 400, cursor: 'pointer' }}
            >
              {FILTER_LABELS[f]} <span style={{ opacity: 0.55, fontSize: '0.72rem' }}>({counts[f]})</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: tokens.color.bg, borderRadius: 9, border: `1px solid ${tokens.color.border}`, padding: '7px 12px', flex: isMobile ? 1 : undefined, minWidth: isMobile ? 0 : 220 }}>
          <span style={{ color: tokens.color.muted, display: 'flex', flexShrink: 0 }}>{Icons.search}</span>
          <input
            placeholder="Buscar OS, cliente, placa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.83rem', color: tokens.color.text, width: '100%' }}
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
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 140px 150px 120px 80px', gap: '0 10px', padding: '9px 16px', background: tokens.color.surfaceHigh, borderRadius: '10px 10px 0 0', border: `1px solid ${tokens.color.border}`, borderBottom: 'none' }}>
              {['Nº OS', 'Cliente', 'Placa', 'Modelo', 'Status', 'Data', ''].map(h => (
                <span key={h} style={{ fontSize: '0.63rem', fontWeight: 700, color: tokens.color.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
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
      <div style={{ background: tokens.color.bg, minHeight: '100vh', paddingBottom: 80, display: 'flex', flexDirection: 'column' }}>
        {content}
        <MobileNav active="ordens" onNav={onNav} onNewOS={onNewOS} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active="ordens" onNav={onNav} />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{content}</main>
    </div>
  );
}

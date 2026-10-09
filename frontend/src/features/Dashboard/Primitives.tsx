import { useState } from 'react';
import type { ReactNode } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { tokens } from '../../constants';

// ── Skeleton ──────────────────────────────────────────────────────────────────

interface SkelProps { w?: string | number; h?: number; r?: number; }
export function Skeleton({ w = '100%', h = 16, r = 6 }: SkelProps) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }}
    />
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps { children: ReactNode; style?: React.CSSProperties; className?: string; onClick?: React.MouseEventHandler<HTMLDivElement>; }
export function Card({ children, style, className = '', onClick }: CardProps) {
  return (
    <div className={`dashboard-card ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { l: string; cls: string }> = {
  rascunho:   { l: 'Em andamento',     cls: 'status-badge--rascunho' },
  finalizada: { l: 'Finalizada',       cls: 'status-badge--finalizada' },
  aguardando: { l: 'Aguardando peças', cls: 'status-badge--aguardando' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.rascunho;
  return <span className={`status-badge ${s.cls}`}>{s.l}</span>;
}

// ── Donut ─────────────────────────────────────────────────────────────────────

function Donut({ pct }: { pct: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const d = Math.min(pct / 100, 1) * c;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="#EDEBE6" strokeWidth="9" />
      <circle
        cx="48" cy="48" r={r} fill="none"
        stroke="#CC1400" strokeWidth="9"
        strokeDasharray={`${d} ${c - d}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.4s ease' }}
      />
      <text
        x="48" y="53" textAnchor="middle"
        fontSize="16" fontWeight="800"
        fontFamily="DM Sans,sans-serif" fill="#1A1A1A"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────

export function ProgressBar({ pct, color = '#CC1400' }: { pct: number; color?: string }) {
  return (
    <div className="dashboard-progress-bar">
      <div
        className="dashboard-progress-bar__fill"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      />
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const chartData = data.map((value, index) => ({ index, value }));
  const maxValue = Math.max(...data, 1);

  return (
    <div style={{ width: 96, height: 40, minWidth: 96 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="index" hide />
          <YAxis hide domain={[0, maxValue]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#CC1400"
            strokeWidth={2}
            fill="rgba(204,20,0,0.14)"
            dot={false}
            activeDot={{ r: 4, fill: '#CC1400', stroke: 'white', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── HeatmapRow ────────────────────────────────────────────────────────────────

export function HeatmapRow({ heatmap }: { heatmap: number[] }) {
  const max = Math.max(...heatmap, 1);
  return (
    <div className="dashboard-heatmap-row">
      {heatmap.slice(0, 7).map((v, i) => {
        const ratio = v / max;
        const alpha = ratio < 0.01 ? 0.08 : 0.12 + ratio * 0.88;
        return (
          <div
            key={i}
            className="dashboard-heatmap-row__cell"
            style={{ background: `rgba(204,20,0,${alpha})` }}
          />
        );
      })}
    </div>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: JSX.Element;
  title: string;
  value: string;
  /** null quando não há período anterior com dados — a comparação some da UI. */
  pct: number | null;
  spark: number[];
  loading: boolean;
  /** Texto ao lado do %. Default mantém o comportamento atual (Visão Geral = mensal). */
  comparisonLabel?: string;
}

export function KpiCard({ icon, title, value, pct, spark, loading, comparisonLabel = 'vs. mês anterior' }: KpiCardProps) {
  const pos = pct !== null && pct >= 0;
  return (
    <Card style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#CC1400', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
              {icon}
            </div>
            <span style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted }}>
              {title}
            </span>
          </div>
          {loading ? (
            <>
              <Skeleton w={120} h={30} r={6} />
              <div style={{ marginTop: 8 }}><Skeleton w={90} h={14} r={4} /></div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: tokens.color.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, minHeight: 17 }}>
                {pct === null ? (
                  <span style={{ fontSize: '0.72rem', color: tokens.color.muted }}>sem comparação disponível</span>
                ) : (
                  <>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: pos ? tokens.color.ok : tokens.color.crit }}>
                      {pos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.72rem', color: tokens.color.muted }}>{comparisonLabel}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <Sparkline data={spark} />
      </div>
    </Card>
  );
}

// ── MetaCard ──────────────────────────────────────────────────────────────────

import { Icons } from './Icons';
import { formatBRL } from '../../utils/dashboard';

interface MetaCardProps {
  /** null = a oficina ainda não definiu a meta. */
  meta: number | null;
  /** Faturamento do mês até agora. */
  alcancado: number;
  /** Pode definir/alterar a meta (configuracoes.editar). */
  editavel: boolean;
  /** Salva a meta (null remove). Deve lançar Error com a mensagem se falhar. */
  onSalvar: (valor: number | null) => Promise<void>;
  loading: boolean;
}

export function MetaCard({ meta, alcancado, editavel, onSalvar, loading }: MetaCardProps) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pct = meta && meta > 0 ? Math.min(100, Math.round((alcancado / meta) * 100)) : 0;

  const abrirEdicao = () => {
    setTexto(meta !== null ? String(meta).replace('.', ',') : '');
    setErro(null);
    setEditando(true);
  };

  const salvar = async (valor: number | null) => {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(valor);
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a meta.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmar = () => {
    const numero = Number(texto.trim().replace(/\./g, '').replace(',', '.'));
    if (texto.trim() === '' || !Number.isFinite(numero) || numero < 0) {
      setErro('Informe um valor válido (ex.: 20000 ou 20.000,00).');
      return;
    }
    salvar(numero);
  };

  const botao: React.CSSProperties = {
    border: 'none', background: 'transparent', color: '#CC1400', fontSize: '0.74rem',
    fontWeight: 700, cursor: 'pointer', padding: 0,
  };

  return (
    <Card style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#CC1400', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          {Icons.target}
        </div>
        <span style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tokens.color.muted }}>
          META MENSAL
        </span>
      </div>
      {loading ? <Skeleton h={80} /> : editando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.7rem', color: tokens.color.muted }} htmlFor="meta-mensal-input">Meta de faturamento do mês (R$)</label>
          <input
            id="meta-mensal-input"
            autoFocus
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false); }}
            disabled={salvando}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${tokens.color.border}`, fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
          />
          {erro && <div style={{ fontSize: '0.72rem', color: tokens.color.crit }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <button style={botao} onClick={confirmar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button style={{ ...botao, color: tokens.color.muted }} onClick={() => setEditando(false)} disabled={salvando}>Cancelar</button>
            {meta !== null && (
              <button style={{ ...botao, color: tokens.color.muted, marginLeft: 'auto' }} onClick={() => salvar(null)} disabled={salvando}>Remover meta</button>
            )}
          </div>
        </div>
      ) : meta === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: tokens.color.text }}>Meta não definida</div>
          <div style={{ fontSize: '0.72rem', color: tokens.color.muted }}>
            Faturado no mês: <strong style={{ color: tokens.color.text }}>{formatBRL(alcancado)}</strong>
          </div>
          {editavel
            ? <button style={{ ...botao, textAlign: 'left' }} onClick={abrirEdicao}>Definir meta</button>
            : <div style={{ fontSize: '0.72rem', color: tokens.color.muted }}>Peça ao dono para definir a meta.</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: tokens.color.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
              Meta {editavel && <button style={botao} onClick={abrirEdicao}>Editar</button>}
            </div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: tokens.color.text }}>{formatBRL(meta)}</div>
            <div style={{ fontSize: '0.7rem', color: tokens.color.muted, marginTop: 8 }}>Alcançado</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: tokens.color.text }}>{formatBRL(alcancado)}</div>
          </div>
          <Donut pct={pct} />
        </div>
      )}
    </Card>
  );
}

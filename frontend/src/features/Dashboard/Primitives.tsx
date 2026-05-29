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

interface CardProps { children: ReactNode; style?: React.CSSProperties; className?: string; }
export function Card({ children, style, className = '' }: CardProps) {
  return (
    <div className={`dashboard-card ${className}`} style={style}>
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

export function Donut({ pct }: { pct: number }) {
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

export function Sparkline({ data }: { data: number[] }) {
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
      {heatmap.slice(0, 6).map((v, i) => {
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
  pct: number;
  spark: number[];
  loading: boolean;
}

export function KpiCard({ icon, title, value, pct, spark, loading }: KpiCardProps) {
  const pos = pct >= 0;
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: pos ? '#1A7F4B' : '#CC1400' }}>
                  {pos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.72rem', color: tokens.color.muted }}>vs. mês anterior</span>
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

import type { DashData } from '../../types/dashboard';
import { Icons } from './Icons';
import { formatBRL } from '../../utils/dashboard';

export function MetaCard({ d, loading }: { d: DashData; loading: boolean }) {
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
      {loading ? <Skeleton h={80} /> : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: tokens.color.muted }}>Meta</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: tokens.color.text }}>{formatBRL(d.metaMensal)}</div>
            <div style={{ fontSize: '0.7rem', color: tokens.color.muted, marginTop: 8 }}>Alcançado</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: tokens.color.text }}>{formatBRL(d.metaAlc)}</div>
          </div>
          <Donut pct={d.metaPct} />
        </div>
      )}
    </Card>
  );
}

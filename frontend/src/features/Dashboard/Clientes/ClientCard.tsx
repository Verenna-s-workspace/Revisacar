import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import { ClienteIcons } from './icons';
import { StatusBadge } from './StatusBadge';
import { formatAgendadoBadge, formatDataCurta, formatMesAno } from '../../../utils/clientes_utils';
import { ownerInitial } from '../../../utils/veiculos_utils';
import type { ClienteComDados } from '../../../types/cliente';

interface ClientCardProps {
  cliente: ClienteComDados;
  onView: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  onGoToAgendamento: (cliente: ClienteComDados) => void;
}

// ── Arte decorativa do avatar (mesma técnica da foto de Veículos, em círculo) ─
// Reaproveita o espírito visual (glow vermelho + linhas onduladas) já usado no
// placeholder de foto dos veículos, recortado em círculo para acompanhar o
// layout de avatar da referência enviada.

const WAVE_VIEWBOX = { w: 160, h: 160 };

function buildWaveLines(count: number): string[] {
  const { w, h } = WAVE_VIEWBOX;
  const STEPS = 48;
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    const y0 = 4 + (i * (h - 8)) / (count - 1);
    const pts: Array<[number, number]> = [];
    for (let step = 0; step <= STEPS; step++) {
      const t = step / STEPS;
      const x = t * w;
      const dist = (t - 0.62) / 0.22;
      const damp = 1 - Math.exp(-(dist * dist));
      const y = y0 + 15 * damp * Math.sin(2.6 * Math.PI * t + i * 0.3);
      pts.push([x, y]);
    }
    const d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ` +
      pts.slice(1).map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    paths.push(d);
  }
  return paths;
}

const AVATAR_WAVE_LINES = buildWaveLines(16);

function AvatarArt({ gradientId }: { gradientId: string }) {
  return (
    <svg
      viewBox={`0 0 ${WAVE_VIEWBOX.w} ${WAVE_VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'blur(1.5px)' }}
    >
      <defs>
        <radialGradient id={gradientId} cx="68%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#FF6355" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#FF7A6C" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#FFB4A8" stopOpacity="0.3" />
        </radialGradient>
      </defs>
      <rect width={WAVE_VIEWBOX.w} height={WAVE_VIEWBOX.h} fill={`url(#${gradientId})`} />
      {AVATAR_WAVE_LINES.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#8A2418" strokeWidth={1} opacity={0.15} />
      ))}
    </svg>
  );
}

function ClientAvatar({ nome, foto, gradientId, size = 54 }: { nome: string; foto?: string; gradientId: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative',
        overflow: 'hidden', border: `1px solid ${tokens.color.border}`, background: 'white',
      }}
    >
      {foto ? (
        <img src={foto} alt={nome} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          <AvatarArt gradientId={gradientId} />
          <div
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: size * 0.36, fontWeight: 800, color: 'white', textShadow: '0 1px 4px rgba(122,32,20,0.5)',
            }}
          >
            {ownerInitial(nome)}
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, danger, children }: { title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        border: `1px solid ${danger ? tokens.color.critBorder : tokens.color.border}`,
        background: danger ? 'transparent' : 'white',
        color: danger ? tokens.color.crit : tokens.color.muted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? tokens.color.critBg : tokens.color.surfaceHigh;
        e.currentTarget.style.borderColor = danger ? tokens.color.crit : tokens.color.borderMd;
        e.currentTarget.style.color = danger ? tokens.color.crit : tokens.color.text;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = danger ? 'transparent' : 'white';
        e.currentTarget.style.borderColor = danger ? tokens.color.critBorder : tokens.color.border;
        e.currentTarget.style.color = danger ? tokens.color.crit : tokens.color.muted;
      }}
    >
      {children}
    </button>
  );
}

function Spec({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
      <span style={{ display: 'flex', color: tokens.color.ghost, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </span>
    </div>
  );
}

export function ClientCard({ cliente: c, onView, onEdit, onSchedule, onDelete, onGoToAgendamento }: ClientCardProps) {
  const gradientId = `cGlow-${c.id}`;
  const qtd = c.veiculos.length;

  return (
    <div
      onClick={onView}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 20, cursor: 'pointer',
        background: 'white', border: `1px solid ${tokens.color.border}`,
        boxShadow: '0 8px 20px rgba(31,15,12,0.07)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 22px 38px rgba(31,15,12,0.1), 0 10px 22px rgba(204,20,0,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(31,15,12,0.07)';
      }}
    >
      {/* Avatar + nome + informações rápidas */}
      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        <ClientAvatar nome={c.nome} foto={c.fotoPrincipal} gradientId={gradientId} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 800, color: tokens.color.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {c.nome}
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: tokens.color.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {qtd === 0 ? 'Sem veículos' : `${qtd} veículo${qtd > 1 ? 's' : ''}`} · cliente desde {formatMesAno(c.createdAt)}
          </div>
        </div>
      </div>

      {/* Badge de status */}
      <div style={{ padding: '11px 16px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatusBadge
          status={c.status}
          dynamicLabel={c.status === 'agendado' && c.proximoAgendamento ? `Agendado • ${formatAgendadoBadge(c.proximoAgendamento)}` : undefined}
          onClick={
            c.status === 'agendado' && c.proximoAgendamento
              ? e => { e.stopPropagation(); onGoToAgendamento(c); }
              : undefined
          }
        />
      </div>

      {/* Contato: telefone + email */}
      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Spec icon={ClienteIcons.phone} value={c.telefone || '—'} />
        <Spec icon={ClienteIcons.mail} value={c.email || '—'} />
      </div>

      {/* Veículo principal + última visita */}
      <div style={{ margin: '13px 16px 0', paddingTop: 12, borderTop: `1px solid ${tokens.color.border}`, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ display: 'flex', color: tokens.color.ghost, flexShrink: 0 }}>{Icons.car}</span>
          {c.veiculoPrincipal ? (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.veiculoPrincipal.marca} {c.veiculoPrincipal.modelo}
              <span style={{ color: tokens.color.muted, fontWeight: 500 }}> · {c.veiculoPrincipal.placa}</span>
            </span>
          ) : (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.color.ghost }}>Nenhum veículo cadastrado</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', color: tokens.color.ghost, flexShrink: 0 }}>{Icons.clock}</span>
          <span style={{ fontSize: '0.76rem', fontWeight: 500, color: tokens.color.muted }}>
            {c.ultimaVisita ? `Última visita em ${formatDataCurta(c.ultimaVisita)}` : 'Ainda sem visitas'}
          </span>
        </div>
      </div>

      {/* Ações */}
      <div
        style={{
          marginTop: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 14px', borderTop: `1px solid ${tokens.color.border}`, background: tokens.color.bg,
        }}
        onClick={e => e.stopPropagation()}
      >
        <ActionBtn title="Visualizar" onClick={onView}>{ClienteIcons.eye}</ActionBtn>
        <ActionBtn title="Editar" onClick={onEdit}>{Icons.edit}</ActionBtn>
        <ActionBtn title="Agendar" onClick={onSchedule}>{Icons.cal}</ActionBtn>
        <ActionBtn title="Excluir" onClick={onDelete} danger>{Icons.trash}</ActionBtn>
      </div>
    </div>
  );
}

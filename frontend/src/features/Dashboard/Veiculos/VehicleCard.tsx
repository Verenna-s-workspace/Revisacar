import { tokens } from '../../../constants';
import { VeiculoIcons } from './icons';
import { Icons } from '../Icons';
import { VEICULO_STATUS_CONFIG } from './StatusBadge';
import { CATEGORIA_LABEL, formatKm, ownerInitial } from '../../../utils/veiculos_utils';
import type { VeiculoCadastrado } from '../../../types/veiculo';

interface VehicleCardProps {
  veiculo: VeiculoCadastrado;
  onView: () => void;
  onEdit: () => void;
  onChangeOwner: () => void;
  onUnlinkOwner: () => void;
  onDelete: () => void;
}

// ── Arte decorativa do placeholder de foto ────────────────────────────────────
// Gerada por parâmetros (não é uma imagem/arquivo) para poder ser ajustada só
// mudando os números abaixo. Reproduz o espírito da referência enviada: um
// glow vermelho suave concentrado no centro-direita, com linhas finas onduladas
// por cima. Some automaticamente assim que `veiculo.fotoPrincipal` é definido —
// nenhuma outra parte do componente precisa mudar para isso acontecer.

const WAVE_VIEWBOX = { w: 400, h: 225 };

function buildWaveLines(opts: {
  count: number; amplitude: number; freq: number; convergeX: number; convergeWidth: number; phaseSpread: number;
}): string[] {
  const { count, amplitude, freq, convergeX, convergeWidth, phaseSpread } = opts;
  const { w, h } = WAVE_VIEWBOX;
  const STEPS = 70;
  const paths: string[] = [];

  for (let i = 0; i < count; i++) {
    const y0 = 8 + (i * (h - 16)) / (count - 1);
    const pts: Array<[number, number]> = [];
    for (let step = 0; step <= STEPS; step++) {
      const t = step / STEPS;
      const x = t * w;
      const dist = (t - convergeX) / convergeWidth;
      const damp = 1 - Math.exp(-(dist * dist));
      const localAmp = amplitude * damp;
      const phase = (i - count / 2) * phaseSpread;
      const y = y0 + localAmp * Math.sin(freq * Math.PI * t * 2 + phase);
      pts.push([x, y]);
    }
    const d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ` +
      pts.slice(1).map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    paths.push(d);
  }
  return paths;
}

// Calculado uma única vez no carregamento do módulo (não recalcula a cada render).
const WAVE_LINES = buildWaveLines({ count: 22, amplitude: 34, freq: 1.5, convergeX: 0.66, convergeWidth: 0.14, phaseSpread: 0.22 });

function PhotoPlaceholderArt({ gradientId }: { gradientId: string }) {
  return (
    <svg
      viewBox={`0 0 ${WAVE_VIEWBOX.w} ${WAVE_VIEWBOX.h}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'blur(2.5px)' }}
    >
      <defs>
        <radialGradient id={gradientId} cx="72%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#FF6355" stopOpacity="0.85" />
          <stop offset="42%" stopColor="#FF7A6C" stopOpacity="0.5" />
          <stop offset="74%" stopColor="#FFB4A8" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#FFB4A8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={WAVE_VIEWBOX.w} height={WAVE_VIEWBOX.h} fill={`url(#${gradientId})`} />
      <g>
        {WAVE_LINES.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#B34A3C" strokeWidth={1} opacity={0.16} />
        ))}
      </g>
    </svg>
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

function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 9px', borderRadius: 7,
        background: bg, border: `1px solid ${border}`, color,
        fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
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

function SpecDivider() {
  return <span style={{ width: 1, height: 14, background: tokens.color.border, flexShrink: 0 }} />;
}

export function VehicleCard({ veiculo: v, onView, onEdit, onChangeOwner, onUnlinkOwner, onDelete }: VehicleCardProps) {
  const hasOwner = !!v.proprietario;
  const statusCfg = VEICULO_STATUS_CONFIG[v.status];
  const gradientId = `vGlow-${v.id}`;

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
      {/* Título: marca (eyebrow) + modelo (destaque) + placa */}
      <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: tokens.color.muted, marginBottom: 3 }}>
            {v.marca}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: tokens.color.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {v.modelo}
          </div>
        </div>
        <span
          style={{
            fontFamily: tokens.fontMono, fontSize: '0.7rem', fontWeight: 700,
            color: tokens.color.ferrari, background: tokens.color.ferrariMid,
            padding: '3px 8px', borderRadius: 6, letterSpacing: '0.03em', flexShrink: 0, marginTop: 2,
          }}
        >
          {v.placa}
        </span>
      </div>

      {/* Tags: categoria + status */}
      <div style={{ padding: '9px 16px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Pill color={tokens.color.muted} bg={tokens.color.surfaceHigh} border={tokens.color.border}>
          {CATEGORIA_LABEL[v.categoria]}
        </Pill>
        <Pill color={statusCfg.color} bg={statusCfg.bg} border={statusCfg.border}>
          {statusCfg.label}
        </Pill>
      </div>

      {/* Área da foto — placeholder com a arte decorativa (glow + linhas).
          Para exibir a foto real, basta preencher `v.fotoPrincipal` (já
          integrado ao formulário de cadastro/edição); nenhum outro trecho
          deste componente precisa ser alterado — a arte decorativa some
          automaticamente e dá lugar à imagem. */}
      <div
        style={{
          margin: '12px 16px 0', aspectRatio: '16 / 9', borderRadius: 14,
          border: `1px solid ${tokens.color.border}`,
          overflow: 'hidden', position: 'relative', flexShrink: 0,
          background: 'white',
        }}
      >
        {v.fotoPrincipal ? (
          <img
            src={v.fotoPrincipal}
            alt={`${v.marca} ${v.modelo}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <PhotoPlaceholderArt gradientId={gradientId} />
        )}
      </div>

      {/* Specs: ano · cor · km */}
      <div style={{ padding: '13px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Spec icon={Icons.cal} value={v.ano} />
        <SpecDivider />
        <Spec icon={VeiculoIcons.palette} value={v.cor || '—'} />
        <SpecDivider />
        <Spec icon={VeiculoIcons.gauge} value={formatKm(v.quilometragem)} />
      </div>

      {/* Cliente / proprietário */}
      <div style={{ margin: '13px 16px 0', paddingTop: 12, borderTop: `1px solid ${tokens.color.border}` }}>
        {hasOwner ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <div style={{
              width: 27, height: 27, borderRadius: '50%', flexShrink: 0,
              background: tokens.color.ferrariMid, color: tokens.color.ferrari,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.66rem', fontWeight: 800,
            }}>
              {ownerInitial(v.proprietario!.nome)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.6rem', color: tokens.color.subtle, lineHeight: 1, marginBottom: 2 }}>Proprietário</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.color.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.proprietario!.nome}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 27, height: 27, borderRadius: '50%', flexShrink: 0,
              background: tokens.color.surfaceHigh, color: tokens.color.ghost,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ display: 'flex', transform: 'scale(0.8)' }}>{Icons.user}</span>
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: tokens.color.ghost }}>Sem Proprietário</div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div
        style={{
          marginTop: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 14px', borderTop: `1px solid ${tokens.color.border}`, background: tokens.color.bg,
        }}
        onClick={e => e.stopPropagation()}
      >
        <ActionBtn title="Visualizar" onClick={onView}>{VeiculoIcons.eye}</ActionBtn>
        <ActionBtn title="Editar" onClick={onEdit}>{Icons.edit}</ActionBtn>
        <ActionBtn title="Alterar Proprietário" onClick={onChangeOwner}>{VeiculoIcons.linkUser}</ActionBtn>
        <ActionBtn title="Desvincular Proprietário" onClick={onUnlinkOwner}>
          <span style={{ opacity: hasOwner ? 1 : 0.35 }}>{VeiculoIcons.unlinkUser}</span>
        </ActionBtn>
        <ActionBtn title="Excluir" onClick={onDelete} danger>{Icons.trash}</ActionBtn>
      </div>
    </div>
  );
}
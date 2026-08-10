import { tokens } from '../../constants';

// Mesmo gerador procedural de linhas onduladas do VehicleCard (Veiculos),
// só que em branco sobre o vermelho em vez de vermelho sobre branco —
// mantém a mesma assinatura visual do app em vez de inventar uma nova.
const WAVE_VIEWBOX = { w: 400, h: 500 };

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

const WAVE_LINES = buildWaveLines({ count: 26, amplitude: 30, freq: 1.3, convergeX: 0.72, convergeWidth: 0.16, phaseSpread: 0.2 });


export function BrandPanel() {
  return (
    <div style={{
      position: 'relative',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      background: `linear-gradient(155deg, ${tokens.color.ferrari} 0%, ${tokens.color.ferrariDark} 55%, ${tokens.color.ferrariDeep} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <svg
        viewBox={`0 0 ${WAVE_VIEWBOX.w} ${WAVE_VIEWBOX.h}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {WAVE_LINES.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="white" strokeWidth={1} opacity={0.13} />
        ))}
      </svg>


      <div style={{ position: 'relative', textAlign: 'center', padding: '0 24px' }}>
        <div style={{
          fontFamily: tokens.fontLogo,
          fontSize: '2.6rem',
          color: 'white',
          letterSpacing: '0.01em',
        }}>
          RevisaCar
        </div>
        <div style={{
          marginTop: 6,
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.75)',
          textTransform: 'uppercase',
        }}>
          Painel da Oficina
        </div>
      </div>
    </div>
  );
}
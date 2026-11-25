import { useCallback, useEffect, useRef, useState } from 'react';
import { tokens } from '../constants';
import { btnGhost } from './ui';

interface Props {
  /** Recebe o PNG (data URL) quando há traço; null quando está em branco. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

const LARGURA = 600;
const ALTURA = 200;

/** Área pra desenhar a assinatura com o dedo/mouse/caneta (pointer events, funciona em touch). */
export function AssinaturaPad({ onChange, disabled }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const temTraco = useRef(false);
  const [vazio, setVazio] = useState(true);

  const contexto = useCallback(() => {
    const ctx = ref.current?.getContext('2d') ?? null;
    if (ctx) {
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111111';
    }
    return ctx;
  }, []);

  useEffect(() => { contexto(); }, [contexto]);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const comecar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = contexto();
    if (!ctx) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    desenhando.current = true;
    const p = ponto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01); // um toque sem arrastar vira um ponto
    ctx.stroke();
    temTraco.current = true;
    setVazio(false);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const ctx = contexto();
    if (!ctx) return;
    const p = ponto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const terminar = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    if (temTraco.current && ref.current) onChange(ref.current.toDataURL('image/png'));
  };

  const limpar = () => {
    const c = ref.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    temTraco.current = false;
    setVazio(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={ref} width={LARGURA} height={ALTURA} aria-label="Área de assinatura do cliente"
        onPointerDown={comecar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} onPointerLeave={terminar}
        style={{
          width: '100%', height: 'auto', aspectRatio: `${LARGURA} / ${ALTURA}`, display: 'block', touchAction: 'none',
          background: tokens.color.surface, border: `1px dashed ${tokens.color.border}`, borderRadius: tokens.radius.md,
          cursor: disabled ? 'not-allowed' : 'crosshair',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: tokens.color.muted }}>
          {vazio ? 'Peça ao cliente para assinar aqui (opcional).' : 'Assinatura registrada.'}
        </span>
        <button type="button" onClick={limpar} disabled={disabled || vazio} style={{ ...btnGhost, padding: '4px 12px' }}>Limpar</button>
      </div>
    </div>
  );
}

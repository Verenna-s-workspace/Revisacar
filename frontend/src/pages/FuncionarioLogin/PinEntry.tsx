import { useEffect } from 'react';
import { tokens } from '../../constants';

const PIN_LENGTH = 6;

interface PinEntryProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoListenKeyboard?: boolean;
}

export function PinEntry({ value, onChange, onComplete, disabled, autoListenKeyboard = true }: PinEntryProps) {
  const appendDigit = (d: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    const next = value + d;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete?.(next);
  };

  const removeDigit = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  // Kiosk normalmente é touch, mas nada impede alguém usar teclado físico
  // (ex.: dono acessando de um notebook) — os dois caminhos convergem no
  // mesmo appendDigit/removeDigit.
  useEffect(() => {
    if (!autoListenKeyboard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') appendDigit(e.key);
      else if (e.key === 'Backspace') removeDigit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, disabled]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 42,
              height: 52,
              borderRadius: 10,
              border: `1.5px solid ${i < value.length ? tokens.color.ferrari : tokens.color.border}`,
              background: tokens.color.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              fontWeight: 700,
              color: tokens.color.text,
            }}
          >
            {i < value.length ? '•' : ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 260, margin: '0 auto' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => appendDigit(d)}
            style={keyStyle}
          >
            {d}
          </button>
        ))}
        <div />
        <button type="button" disabled={disabled} onClick={() => appendDigit('0')} style={keyStyle}>0</button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={removeDigit}
          style={{ ...keyStyle, color: tokens.color.muted, opacity: value.length === 0 ? 0.4 : 1 }}
          aria-label="Apagar dígito"
        >
          {'⌫'}
        </button>
      </div>
    </div>
  );
}

const keyStyle: React.CSSProperties = {
  height: 56,
  borderRadius: 12,
  border: `1px solid ${tokens.color.border}`,
  background: tokens.color.surface,
  color: tokens.color.text,
  fontSize: '1.25rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
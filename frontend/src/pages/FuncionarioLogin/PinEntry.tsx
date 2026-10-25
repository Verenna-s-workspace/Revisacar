import { useEffect } from 'react';

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
      <div className="auth-pin-boxes">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div key={i} className={`auth-pin-box${i < value.length ? ' is-filled' : ''}`}>
            {i < value.length ? '•' : ''}
          </div>
        ))}
      </div>

      <div className="auth-pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="auth-pin-key" disabled={disabled} onClick={() => appendDigit(d)}>
            {d}
          </button>
        ))}
        <div />
        <button type="button" className="auth-pin-key" disabled={disabled} onClick={() => appendDigit('0')}>0</button>
        <button
          type="button"
          className="auth-pin-key is-muted"
          disabled={disabled || value.length === 0}
          onClick={removeDigit}
          aria-label="Apagar dígito"
        >
          {'⌫'}
        </button>
      </div>
    </div>
  );
}

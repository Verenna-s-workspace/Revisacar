import { useState } from 'react';
import { tokens } from '../../../constants';
import {
  DURACOES_RAPIDAS,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  formatDuracao,
} from '../../../utils/agenda';

interface DuracaoSelectorProps {
  /** Duração em minutos. */
  value: number;
  onChange: (min: number) => void;
}

/** Seletor de duração do serviço: atalhos (30 min, 1 h, 1 h 30, 2 h) + "Outro" em minutos.
 * Só a oficina usa isto — o cliente nunca define o tempo de trabalho. */
export function DuracaoSelector({ value, onChange }: DuracaoSelectorProps) {
  const rapida = (DURACOES_RAPIDAS as readonly number[]).includes(value);
  const [outro, setOutro] = useState(!rapida);
  const [texto, setTexto] = useState(String(value));

  const invalido = value < MIN_DURATION_MINUTES || value > MAX_DURATION_MINUTES;

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: ativo ? 700 : 500,
    border: `1.5px solid ${ativo ? tokens.color.ferrari : tokens.color.border}`,
    background: ativo ? tokens.color.ferrariMid : 'white',
    color: ativo ? tokens.color.ferrari : tokens.color.text,
  });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DURACOES_RAPIDAS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => { setOutro(false); setTexto(String(d)); onChange(d); }}
            style={chip(!outro && value === d)}
          >
            {formatDuracao(d)}
          </button>
        ))}
        <button type="button" onClick={() => setOutro(true)} style={chip(outro)}>Outro</button>
      </div>
      {outro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            step={15}
            value={texto}
            aria-label="Duração em minutos"
            onChange={e => {
              setTexto(e.target.value);
              const n = parseInt(e.target.value, 10);
              onChange(Number.isFinite(n) ? n : 0);
            }}
            style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${invalido ? tokens.color.crit : tokens.color.border}`, fontSize: '0.85rem' }}
          />
          <span style={{ fontSize: '0.8rem', color: tokens.color.muted }}>minutos</span>
        </div>
      )}
      {invalido && (
        <div style={{ fontSize: '0.75rem', color: tokens.color.crit, marginTop: 6 }}>
          A duração deve ficar entre {MIN_DURATION_MINUTES} min e {formatDuracao(MAX_DURATION_MINUTES)}.
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Input } from '../../../components/inputs/input';
import { ModalChoices } from '../../../components/system';
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

const OUTRO = 'outro';

/** Seletor de duração do serviço: atalhos (30 min, 1 h, 1 h 30, 2 h) + "Outro" em minutos.
 * Só a oficina usa isto — o cliente nunca define o tempo de trabalho. */
export function DuracaoSelector({ value, onChange }: DuracaoSelectorProps) {
  const rapida = (DURACOES_RAPIDAS as readonly number[]).includes(value);
  const [outro, setOutro] = useState(!rapida);
  const [texto, setTexto] = useState(String(value));

  const invalido = value < MIN_DURATION_MINUTES || value > MAX_DURATION_MINUTES;

  const opcoes = [
    ...DURACOES_RAPIDAS.map(d => ({ value: String(d), label: formatDuracao(d) })),
    { value: OUTRO, label: 'Outro' },
  ];

  const escolher = (v: string) => {
    if (v === OUTRO) { setOutro(true); return; }
    const d = Number(v);
    setOutro(false);
    setTexto(String(d));
    onChange(d);
  };

  return (
    <>
      <ModalChoices label="Duração" value={outro ? OUTRO : String(value)} options={opcoes} onChange={escolher} />
      {outro && (
        <Input
          name="duracao_minutos"
          type="number"
          label="Duração em minutos"
          min={MIN_DURATION_MINUTES}
          max={MAX_DURATION_MINUTES}
          step={15}
          value={texto}
          error={invalido ? `A duração deve ficar entre ${MIN_DURATION_MINUTES} min e ${formatDuracao(MAX_DURATION_MINUTES)}.` : undefined}
          onChangeValue={v => {
            setTexto(v);
            const n = parseInt(v, 10);
            onChange(Number.isFinite(n) ? n : 0);
          }}
        />
      )}
    </>
  );
}

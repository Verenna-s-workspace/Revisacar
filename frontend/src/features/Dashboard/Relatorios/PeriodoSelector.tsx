import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { tokens } from '../../../constants';
import { Icons } from '../Icons';
import type { FiltroPeriodo, IntervaloDatas, PeriodoPreset } from '../../../types/relatorios';
import { formatarIntervalo } from '../../../utils/relatorios';

const OPCOES: { valor: PeriodoPreset; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ultimos_7_dias', rotulo: 'Últimos 7 dias' },
  { valor: 'ultimos_30_dias', rotulo: 'Últimos 30 dias' },
  { valor: 'este_mes', rotulo: 'Este mês' },
  { valor: 'mes_passado', rotulo: 'Mês passado' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

function paraInputDate(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

interface PeriodoSelectorProps {
  filtro: FiltroPeriodo;
  intervaloAtual: IntervaloDatas;
  isMobile: boolean;
  onChange: (filtro: FiltroPeriodo) => void;
}

export function PeriodoSelector({ filtro, intervaloAtual, isMobile, onChange }: PeriodoSelectorProps) {
  const [range, setRange] = useState(() => ({
    inicio: paraInputDate(filtro.personalizado?.inicio ?? intervaloAtual.inicio),
    fim: paraInputDate(filtro.personalizado?.fim ?? intervaloAtual.fim),
  }));

  function selecionarPreset(e: ChangeEvent<HTMLSelectElement>) {
    const preset = e.target.value as PeriodoPreset;
    if (preset === 'personalizado') {
      onChange({
        preset,
        personalizado: { inicio: new Date(`${range.inicio}T00:00:00`), fim: new Date(`${range.fim}T00:00:00`) },
      });
      return;
    }
    onChange({ preset });
  }

  function aplicarData(campo: 'inicio' | 'fim', valor: string) {
    const novoRange = { ...range, [campo]: valor };
    setRange(novoRange);
    onChange({
      preset: 'personalizado',
      personalizado: {
        inicio: new Date(`${novoRange.inicio}T00:00:00`),
        fim: new Date(`${novoRange.fim}T00:00:00`),
      },
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: isMobile ? '10px 16px' : '12px 28px',
        background: 'white',
        borderBottom: `1px solid ${tokens.color.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: tokens.color.muted, flexShrink: 0 }}>
        <span style={{ display: 'flex' }}>{Icons.cal}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Período:</span>
      </div>

      <select className="dashboard-card__select" value={filtro.preset} onChange={selecionarPreset}>
        {OPCOES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>

      {filtro.preset === 'personalizado' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="date"
            className="dashboard-card__select"
            value={range.inicio}
            max={range.fim}
            onChange={(e) => aplicarData('inicio', e.target.value)}
          />
          <span style={{ fontSize: '0.78rem', color: tokens.color.muted }}>até</span>
          <input
            type="date"
            className="dashboard-card__select"
            value={range.fim}
            min={range.inicio}
            max={paraInputDate(new Date())}
            onChange={(e) => aplicarData('fim', e.target.value)}
          />
        </div>
      )}

      {!isMobile && (
        <span style={{ fontSize: '0.75rem', color: tokens.color.subtle, marginLeft: 'auto' }}>
          {formatarIntervalo(intervaloAtual)}
        </span>
      )}
    </div>
  );
}

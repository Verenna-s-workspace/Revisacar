import { useState } from 'react';
import { Input } from '../../../components/inputs/input';
import { formatarIntervalo } from '../../../utils/relatorios';
import type { FiltroPeriodo, IntervaloDatas, PeriodoPreset } from '../../../types/relatorios';
import { IcCalendario } from './relatoriosIcones';

const OPCOES_PERIODO: { valor: PeriodoPreset; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ultimos_7_dias', rotulo: '7 dias' },
  { valor: 'ultimos_30_dias', rotulo: '30 dias' },
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

interface RelatoriosHeaderProps {
  filtro: FiltroPeriodo;
  intervaloAtual: IntervaloDatas;
  onChange: (filtro: FiltroPeriodo) => void;
}

export function RelatoriosHeader({ filtro, intervaloAtual, onChange }: RelatoriosHeaderProps) {
  const [range, setRange] = useState(() => ({
    inicio: paraInputDate(filtro.personalizado?.inicio ?? intervaloAtual.inicio),
    fim: paraInputDate(filtro.personalizado?.fim ?? intervaloAtual.fim),
  }));

  function selecionarPreset(preset: PeriodoPreset) {
    if (preset === 'personalizado') {
      const inicioAtual = paraInputDate(intervaloAtual.inicio);
      const fimAtual = paraInputDate(intervaloAtual.fim);
      setRange({ inicio: inicioAtual, fim: fimAtual });
      onChange({
        preset,
        personalizado: {
          inicio: new Date(`${inicioAtual}T00:00:00`),
          fim: new Date(`${fimAtual}T00:00:00`),
        },
      });
      return;
    }
    onChange({ preset });
  }

  function aplicarData(campo: 'inicio' | 'fim', valor: string) {
    if (!valor) return;
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
    <div className='rel-header-wrap'>
      <header className='rel-header'>
        <div className='rel-header__titulos'>
          <h1 className='rel-titulo'>Relatórios</h1>
          <p className='rel-subtitulo'>
            <span>Desempenho, faturamento e operações da oficina</span>
            <span aria-hidden='true'>·</span>
            <strong>{formatarIntervalo(intervaloAtual)}</strong>
          </p>
        </div>

        <div className='rel-header__acoes'>
          <div className='rel-seg' role='group' aria-label='Período do relatório'>
            {OPCOES_PERIODO.map((op) => (
              <button
                key={op.valor}
                type='button'
                className='rel-seg__btn'
                aria-pressed={filtro.preset === op.valor}
                onClick={() => selecionarPreset(op.valor)}
              >
                {op.rotulo}
              </button>
            ))}
          </div>
        </div>
      </header>

      {filtro.preset === 'personalizado' && (
        <div className='rel-periodo-custom'>
          <span className='rel-periodo-custom__rotulo'>
            {IcCalendario} Intervalo personalizado
          </span>
          <div className='rel-periodo-custom__campos'>
            <Input
              name='relatorios_desktop_data_inicio'
              type='date'
              value={range.inicio}
              max={range.fim}
              onChangeValue={(v) => aplicarData('inicio', v)}
            />
            <span className='rel-periodo-custom__ate'>até</span>
            <Input
              name='relatorios_desktop_data_fim'
              type='date'
              value={range.fim}
              min={range.inicio}
              max={paraInputDate(new Date())}
              onChangeValue={(v) => aplicarData('fim', v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
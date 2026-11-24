import { useMemo, useState } from 'react';
import { BotaoPrivacidade } from '../../../components/Privacidade';
import { formatarIntervalo, resolverIntervalo } from '../../../utils/relatorios';
import type { FiltroPeriodo, IntervaloDatas, PeriodoPreset } from '../../../types/relatorios';
import { PeriodoModal } from '../Financeiro/PeriodoModal';
import type { OpcaoPeriodoModal, PeriodoModalValor } from '../Financeiro/PeriodoModal';
import { Icons } from '../Icons';
import { IcCalendario } from './relatoriosIcones';

const PRESETS: { id: PeriodoPreset; titulo: string }[] = [
  { id: 'hoje', titulo: 'Hoje' },
  { id: 'ultimos_7_dias', titulo: 'Últimos 7 dias' },
  { id: 'ultimos_30_dias', titulo: 'Últimos 30 dias' },
  { id: 'este_mes', titulo: 'Este mês' },
  { id: 'mes_passado', titulo: 'Mês passado' },
  { id: 'personalizado', titulo: 'Período personalizado' },
];

function paraInputDate(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

interface RelatoriosMobileHeaderProps {
  filtro: FiltroPeriodo;
  intervaloAtual: IntervaloDatas;
  onChange: (filtro: FiltroPeriodo) => void;
  onVoltar: () => void;
}

export function RelatoriosMobileHeader({
  filtro,
  intervaloAtual,
  onChange,
  onVoltar,
}: RelatoriosMobileHeaderProps) {
  const [modalPeriodo, setModalPeriodo] = useState(false);

  const opcoes = useMemo<OpcaoPeriodoModal[]>(() => {
    return PRESETS.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      dica:
        p.id === 'personalizado'
          ? 'Escolha a data inicial e a final'
          : formatarIntervalo(resolverIntervalo(p.id)),
    }));
  }, []);

  const atualModal: PeriodoModalValor<PeriodoPreset> = {
    id: filtro.preset,
    de: filtro.personalizado ? paraInputDate(filtro.personalizado.inicio) : undefined,
    ate: filtro.personalizado ? paraInputDate(filtro.personalizado.fim) : undefined,
  };

  function aplicarPeriodo(sel: PeriodoModalValor<PeriodoPreset>) {
    if (sel.id === 'personalizado' && sel.de && sel.ate) {
      onChange({
        preset: 'personalizado',
        personalizado: {
          inicio: new Date(`${sel.de}T00:00:00`),
          fim: new Date(`${sel.ate}T00:00:00`),
        },
      });
    } else {
      onChange({ preset: sel.id });
    }
    setModalPeriodo(false);
  }

  return (
    <header className='relm-topo'>
      <div className='relm-barra'>
        <button
          type='button'
          className='relm-voltar'
          onClick={onVoltar}
          aria-label='Voltar para a Visão Geral'
        >
          {Icons.chevL}
        </button>
        <div className='relm-barra__titulos'>
          <h1 className='relm-titulo'>Relatórios</h1>
          <p className='relm-subtitulo'>{formatarIntervalo(intervaloAtual)}</p>
        </div>
        <BotaoPrivacidade variante='mobile' />
        <button
          type='button'
          className='relm-filtros-btn'
          onClick={() => setModalPeriodo(true)}
          aria-haspopup='dialog'
        >
          {IcCalendario} Filtros
        </button>
      </div>

      {modalPeriodo && (
        <PeriodoModal
          atual={atualModal}
          opcoes={opcoes}
          descricao='Escolha o intervalo que os Relatórios vão mostrar.'
          maxData={paraInputDate(new Date())}
          onFechar={() => setModalPeriodo(false)}
          onAplicar={aplicarPeriodo}
        />
      )}
    </header>
  );
}
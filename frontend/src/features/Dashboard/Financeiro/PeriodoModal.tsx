import { useMemo, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalSection, ModalFooter, ModalNotice } from '../../../components/system/Modal';
import { Button } from '../../../components/system/Button';
import { Input } from '../../../components/inputs/input';
import {
  ORDEM_PERIODOS, ROTULO_PERIODO, descreverPeriodo, validarIntervalo, MAX_DIAS_PERIODO,
} from '../../../utils/financeiro_utils';
import type { PeriodoId } from '../../../utils/financeiro_utils';
import { IcCalendario } from './icones';
import './financeiroDesktop.css';

export interface OpcaoPeriodoModal {
  id: string;
  titulo: string;
  dica: string;
}

export interface PeriodoModalValor<T extends string = PeriodoId> {
  id: T;
  de?: string;
  ate?: string;
}

interface Props<T extends string = PeriodoId> {
  atual: PeriodoModalValor<T>;
  onAplicar: (sel: PeriodoModalValor<T>) => void;
  onFechar: () => void;
  opcoes?: OpcaoPeriodoModal[];
  descricao?: string;
  maxData?: string;
}

/** Escolha do período: atalhos prontos ou um intervalo personalizado (data inicial e final). */
export function PeriodoModal<T extends string = PeriodoId>({
  atual,
  onAplicar,
  onFechar,
  opcoes,
  descricao = 'Escolha o intervalo que o Financeiro vai mostrar.',
  maxData,
}: Props<T>) {
  const [id, setId] = useState<string>(atual.id);
  const [de, setDe] = useState(atual.de ?? '');
  const [ate, setAte] = useState(atual.ate ?? '');
  const [tentou, setTentou] = useState(false);

  const personalizado = id === 'personalizado';
  const erroBase = personalizado ? (de && ate ? validarIntervalo(de, ate) : 'Informe a data inicial e a data final.') : null;
  const erro = erroBase ?? (personalizado && maxData && ate > maxData ? 'A data final não pode ser no futuro.' : null);

  // Dica de cada atalho: usa as opções passadas ou as datas que o Financeiro cobre hoje.
  const listaOpcoes = useMemo<OpcaoPeriodoModal[]>(() => {
    if (opcoes) return opcoes;
    const hoje = new Date();
    return ORDEM_PERIODOS.map(p => ({
      id: p,
      titulo: ROTULO_PERIODO[p],
      dica: p === 'personalizado' ? 'Escolha a data inicial e a final' : descreverPeriodo({ id: p }, hoje),
    }));
  }, [opcoes]);

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    if (erro) { setTentou(true); return; }
    onAplicar((personalizado ? { id, de, ate } : { id }) as PeriodoModalValor<T>);
  };

  return (
    <Modal size='sm' onClose={onFechar} onSubmit={aplicar}>
      <ModalHeader icon={IcCalendario} title='Período' description={descricao} />
      <ModalBody>
        <ModalSection title='Atalhos'>
          <div className='fin-opcoes' role='radiogroup' aria-label='Período'>
            {listaOpcoes.map(op => (
              <div key={op.id} className='fin-opcao'>
                <label className='fin-opcao__rotulo'>
                  <input
                    type='radio'
                    name='fin-periodo'
                    className='fin-opcao__radio'
                    checked={id === op.id}
                    onChange={() => setId(op.id)}
                  />
                  <span className='fin-opcao__texto'>
                    <span className='fin-opcao__titulo'>{op.titulo}</span>
                    <span className='fin-opcao__dica'>{op.dica}</span>
                  </span>
                </label>
                {op.id === 'personalizado' && personalizado && (
                  <div className='fin-opcao__datas'>
                    <Input
                      name='fin-periodo-de'
                      type='date'
                      label='Data inicial'
                      value={de}
                      onChangeValue={setDe}
                      max={ate || maxData || undefined}
                    />
                    <Input
                      name='fin-periodo-ate'
                      type='date'
                      label='Data final'
                      value={ate}
                      onChangeValue={setAte}
                      min={de || undefined}
                      max={maxData || undefined}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalSection>
      </ModalBody>
      <ModalFooter
        hint={personalizado ? `Máximo de ${MAX_DIAS_PERIODO} dias.` : undefined}
        notice={tentou && erro ? <ModalNotice tone='error' role='alert'>{erro}</ModalNotice> : undefined}
      >
        <Button variant='ghost' onClick={onFechar}>Cancelar</Button>
        <Button variant='primary' type='submit'>Aplicar</Button>
      </ModalFooter>
    </Modal>
  );
}
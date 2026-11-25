import { useMemo, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalSection, ModalFooter, ModalNotice } from '../../../components/system/Modal';
import { Button } from '../../../components/system/Button';
import { Input } from '../../../components/inputs/input';
import {
  ORDEM_PERIODOS, ROTULO_PERIODO, descreverPeriodo, validarIntervalo, MAX_DIAS_PERIODO,
} from '../../../utils/financeiro_utils';
import type { PeriodoId, PeriodoSel } from '../../../utils/financeiro_utils';
import { IcCalendario } from './icones';

interface Props {
  atual: PeriodoSel;
  onAplicar: (sel: PeriodoSel) => void;
  onFechar: () => void;
}

/** Escolha do período do Financeiro: atalhos prontos ou um intervalo personalizado (data inicial e final). */
export function PeriodoModal({ atual, onAplicar, onFechar }: Props) {
  const [id, setId] = useState<PeriodoId>(atual.id);
  const [de, setDe] = useState(atual.de ?? '');
  const [ate, setAte] = useState(atual.ate ?? '');
  const [tentou, setTentou] = useState(false);

  const personalizado = id === 'personalizado';
  const erro = personalizado ? (de && ate ? validarIntervalo(de, ate) : 'Informe a data inicial e a data final.') : null;

  // Dica de cada atalho: as datas que ele cobre hoje.
  const dicas = useMemo(() => {
    const hoje = new Date();
    const mapa: Partial<Record<PeriodoId, string>> = {};
    for (const p of ORDEM_PERIODOS) {
      if (p !== 'personalizado') mapa[p] = descreverPeriodo({ id: p }, hoje);
    }
    return mapa;
  }, []);

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    if (erro) { setTentou(true); return; }
    onAplicar(personalizado ? { id, de, ate } : { id });
  };

  return (
    <Modal size="sm" onClose={onFechar} onSubmit={aplicar}>
      <ModalHeader icon={IcCalendario} title="Período" description="Escolha o intervalo que o Financeiro vai mostrar." />
      <ModalBody>
        <ModalSection title="Atalhos">
          <div className="fin-opcoes" role="radiogroup" aria-label="Período">
            {ORDEM_PERIODOS.map(p => (
              <div key={p} className="fin-opcao">
                <label className="fin-opcao__rotulo">
                  <input
                    type="radio" name="fin-periodo" className="fin-opcao__radio"
                    checked={id === p} onChange={() => setId(p)}
                  />
                  <span className="fin-opcao__texto">
                    <span className="fin-opcao__titulo">{ROTULO_PERIODO[p]}</span>
                    <span className="fin-opcao__dica">{p === 'personalizado' ? 'Escolha a data inicial e a final' : dicas[p]}</span>
                  </span>
                </label>
                {p === 'personalizado' && personalizado && (
                  <div className="fin-opcao__datas">
                    <Input name="fin-periodo-de" type="date" label="Data inicial" value={de} onChangeValue={setDe} max={ate || undefined} />
                    <Input name="fin-periodo-ate" type="date" label="Data final" value={ate} onChangeValue={setAte} min={de || undefined} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalSection>
      </ModalBody>
      <ModalFooter
        hint={personalizado ? `Máximo de ${MAX_DIAS_PERIODO} dias.` : undefined}
        notice={tentou && erro ? <ModalNotice tone="error" role="alert">{erro}</ModalNotice> : undefined}
      >
        <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
        <Button variant="primary" type="submit">Aplicar</Button>
      </ModalFooter>
    </Modal>
  );
}

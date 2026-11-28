import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { STATUS_CONFIG } from '../../../constants';
import { Textarea } from '../../../components/inputs/textarea';
import { LIM } from '../../../utils/campos_checklist';
import { IcAlerta, IcCheck, IcCriticoX, IcLapis, IcMenos, IcTroca, IcX } from './icones';
import './diagnostico.css';

const ATALHOS: Record<string, string> = { '1': 'ok', '2': 'warn', '3': 'crit', '4': 'na' };
const ICONE_STATUS: Record<string, JSX.Element> = {
  ok: <IcCheck />, warn: <IcAlerta />, crit: <IcCriticoX />, na: <IcMenos />,
};

interface ItemInspecaoProps {
  sid: string;
  name: string;
  data: { status: string | null; obs: string } | undefined;
  onSetStatus: (key: string, val: string) => void;
  onSetObs: (key: string, val: string) => void;
  /** Marcado para troca (vai para a tabela de peças). */
  trocado: boolean;
  onToggleTroca: (key: string, pecaNome: string) => void;
  /** Só nos itens digitados à mão (sistema personalizado). */
  onRemover?: () => void;
}

/**
 * Linha de um item de inspeção: nome + observação · 4 status (ícone + texto, sólido quando escolhido) · Trocar · observação.
 * Desktop: atalhos 1–4 e ↑/↓ com o foco na linha. Crítico abre a observação sozinho e destaca a linha (não bloqueia nada).
 */
export function ItemInspecao({ sid, name, data, onSetStatus, onSetObs, trocado, onToggleTroca, onRemover }: ItemInspecaoProps) {
  const key = `${sid}:${name}`;
  const status = data?.status ?? null;
  const obs = data?.obs ?? '';
  const [editor, setEditor] = useState(false);

  const escolher = (val: string) => {
    onSetStatus(key, val);
    if (val === 'crit' && status !== 'crit') setEditor(true);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('textarea, input')) return;
    const val = ATALHOS[e.key];
    if (val) { e.preventDefault(); escolher(val); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const lista = e.currentTarget.closest('ul');
      const linhas: HTMLElement[] = lista ? Array.from(lista.querySelectorAll<HTMLElement>('[data-linha-item]')) : [];
      const i = linhas.indexOf(e.currentTarget);
      const alvo = linhas[i + (e.key === 'ArrowDown' ? 1 : -1)];
      if (alvo) { e.preventDefault(); alvo.focus(); }
    }
  };

  const critSemObs = status === 'crit' && !obs.trim();

  return (
    <div className="osd-item" data-linha-item data-status={status ?? 'nenhum'} tabIndex={-1} role="group" aria-label={name} onKeyDown={aoTeclar}>
      <div className="osd-item__id">
        <span className="osd-item__nome">{name}</span>
        {!editor && obs && <p className="osd-item__obs" data-tom={status === 'crit' ? 'crit' : undefined}>{obs}</p>}
        {!editor && critSemObs && <p className="osd-item__obs" data-tom="crit">Crítico: descreva o problema no lápis.</p>}
      </div>

      <div className="osd-item__status" role="radiogroup" aria-label={`Status: ${name}`}>
        {(Object.keys(STATUS_CONFIG) as string[]).map((val) => (
          <button
            key={val} type="button" role="radio" className="osd-st" data-tom={val} aria-checked={status === val} onClick={() => escolher(val)}
          >
            {ICONE_STATUS[val]}
            {STATUS_CONFIG[val].label}
          </button>
        ))}
      </div>

      <div className="osd-item__acoes">
        <button
          type="button" className="osd-ib" aria-pressed={trocado} onClick={() => onToggleTroca(key, name)}
          title={trocado ? 'Remover da lista de troca' : 'Marcar para troca'}
        >
          <IcTroca size={16} />
          Trocar
        </button>
        <button
          type="button" className="osd-ib osd-ib--obs" data-tem={obs ? 'true' : 'false'} aria-expanded={editor}
          aria-label={obs ? 'Editar observação' : 'Adicionar observação'} title={obs ? 'Editar observação' : 'Adicionar observação'}
          onClick={() => setEditor((o) => !o)}
        >
          <IcLapis size={16} />
        </button>
        {onRemover && (
          <button type="button" className="osd-ib osd-ib--rm" aria-label={`Remover ${name}`} title="Remover item" onClick={onRemover}>
            <IcX size={16} />
          </button>
        )}
      </div>

      {editor && (
        <div className="osd-item__editor">
          <Textarea
            name={`obs-${key}`} label="Observação técnica" value={obs} onChangeValue={(v) => onSetObs(key, v)}
            rows={2} maxLength={LIM.obsItem} placeholder="Observação técnica..." autoFocus
          />
        </div>
      )}
    </div>
  );
}

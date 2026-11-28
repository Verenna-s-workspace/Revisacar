import type { TabelaPeca } from '../../../types';
import { LIM } from '../../../utils/campos_checklist';
import { IcX } from './icones';
import './diagnostico.css';

interface TabelaPecasProps {
  pecas: readonly TabelaPeca[];
  /** false = só leitura (prévia da etapa Texto). */
  editavel?: boolean;
  onAtualizar?: (id: string, campo: string, valor: string) => void;
  onRemover?: (id: string) => void;
}

const CAMPOS: { chave: 'modelo' | 'marca' | 'codigo' | 'quantidade'; rotulo: string; exemplo: string; max: number; numerico?: boolean }[] = [
  { chave: 'modelo',     rotulo: 'Modelo', exemplo: 'Ex: HB20',   max: LIM.pecaModelo },
  { chave: 'marca',      rotulo: 'Marca',  exemplo: 'Ex: Bosch',  max: LIM.pecaMarca },
  { chave: 'codigo',     rotulo: 'Código', exemplo: 'Ex: F49FH2', max: LIM.pecaCodigo },
  { chave: 'quantidade', rotulo: 'Qtd.',   exemplo: '1',          max: LIM.pecaQtdDigitos, numerico: true },
];

/**
 * Tabela de peças no mesmo desenho das tabelas de Estoque, Serviços, Veículos e Clientes (cabeçalho cinza, linhas de 56px).
 * Cabeçalho e linhas leem as mesmas colunas (--osd-cols). Quando o card é estreito, cada linha vira um cartão com rótulos.
 * Colunas e ações são as de antes: Peça (travada nas automáticas, com selo "auto"), Modelo, Marca, Código, Qtd. e remover.
 */
export function TabelaPecas({ pecas, editavel = true, onAtualizar, onRemover }: TabelaPecasProps) {
  return (
    <div className={`osd-tabela${editavel ? '' : ' osd-tabela--leitura'}`} role="table" aria-label="Peças para troca">
      <div className="osd-thead" role="row">
        <div role="columnheader">Peça</div>
        {CAMPOS.map((c) => <div key={c.chave} role="columnheader">{c.rotulo}</div>)}
        {editavel && <div role="columnheader"><span className="osd-sr">Ações</span></div>}
      </div>

      {pecas.map((p, i) => {
        const nomeLinha = p.peca || `peça ${i + 1}`;
        return (
          <div key={p.id} className="osd-linha" role="row">
            <div className="osd-cel osd-cel--peca" role="cell">
              {editavel && !p.isAuto ? (
                <input
                  className="osd-campo" value={p.peca} maxLength={LIM.peca} placeholder="Nome da peça..."
                  aria-label={`Nome da peça ${i + 1}`} onChange={(e) => onAtualizar?.(p.id, 'peca', e.target.value)}
                />
              ) : (
                <span className="osd-cel__nome">{p.peca || <span className="osd-vazio-cel">Sem nome</span>}</span>
              )}
              {p.isAuto && <span className="osd-auto" title="Adicionada pelo botão Trocar do diagnóstico">auto</span>}
            </div>

            {CAMPOS.map((c) => (
              <div key={c.chave} className="osd-cel" role="cell">
                <span className="osd-cel__rot" aria-hidden="true">{c.rotulo}</span>
                {editavel ? (
                  <input
                    className="osd-campo" type="text" inputMode={c.numerico ? 'numeric' : undefined} maxLength={c.max}
                    value={p[c.chave]} placeholder={c.exemplo} aria-label={`${c.rotulo} — ${nomeLinha}`}
                    onChange={(e) => onAtualizar?.(p.id, c.chave, e.target.value)}
                  />
                ) : (
                  p[c.chave] ? <span>{p[c.chave]}</span> : <span className="osd-vazio-cel">—</span>
                )}
              </div>
            ))}

            {editavel && (
              <div className="osd-cel osd-cel--acao" role="cell">
                <button type="button" className="osd-ib osd-ib--rm" aria-label={`Remover ${nomeLinha}`} title="Remover linha" onClick={() => onRemover?.(p.id)}>
                  <IcX size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

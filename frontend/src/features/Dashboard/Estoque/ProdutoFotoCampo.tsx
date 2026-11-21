import type { ChangeEvent } from 'react';
import { Button, ModalNotice } from '../../../components/system';
import { CaixasEmpilhadasSvg } from './ilustracoes';
import './produtoModal.css';

interface ProdutoFotoCampoProps {
  /** Foto atual (data URL). Ausente = ilustração das três caixas, a mesma da lista. */
  foto?: string;
  comprimindo: boolean;
  erro: string | null;
  onSelecionar: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemover: () => void;
}

/** Conteúdo da seção "Foto do produto": prévia, trocar/remover e erro de processamento. */
export function ProdutoFotoCampo({ foto, comprimindo, erro, onSelecionar, onRemover }: ProdutoFotoCampoProps) {
  return (
    <>
      <div className="pf-tile">
        {foto
          ? <img className="pf-tile__img" src={foto} alt="Prévia da foto do produto" />
          : <CaixasEmpilhadasSvg className="pf-tile__padrao" />}
      </div>

      <div className="pf-acoes">
        {/* O input fica escondido só visualmente: continua alcançável pelo teclado (foco aparece no botão) */}
        <label
          className="sys-btn sys-btn--secondary sys-btn--sm pf-botao"
          aria-disabled={comprimindo || undefined}
          style={{ cursor: comprimindo ? 'wait' : 'pointer' }}
        >
          {comprimindo ? 'Processando...' : foto ? 'Trocar foto' : 'Adicionar foto'}
          <input className="pf-input" type="file" accept="image/*" onChange={onSelecionar} disabled={comprimindo} />
        </label>
        {foto && (
          <Button variant="ghost" size="sm" className="pf-remover" onClick={onRemover}>
            Remover foto
          </Button>
        )}
      </div>

      {erro && <ModalNotice tone="error" role="alert">{erro}</ModalNotice>}
    </>
  );
}

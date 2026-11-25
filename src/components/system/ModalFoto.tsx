import type { ChangeEvent, ReactNode } from 'react';
import { Button } from './Button';
import { ModalNotice } from './Modal';

export interface ModalFotoCampoProps {
  /** Foto atual (data URL). */
  foto?: string;
  alt: string;
  /** Estado sem foto: ícone/ilustração + texto curto. */
  vazio?: ReactNode;
  /** tile = bloco 4:3 (produto, veículo) · avatar = círculo (pessoas). */
  forma?: 'tile' | 'avatar';
  comprimindo: boolean;
  erro?: string | null;
  /** Texto de apoio abaixo dos botões. */
  hint?: ReactNode;
  onSelecionar: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemover: () => void;
}

/**
 * Conteúdo de uma seção de foto única: prévia · Adicionar/Trocar · Remover · erro.
 * Mesmo desenho do campo de foto do modal de produto, para qualquer cadastro com foto.
 * O input fica escondido só visualmente: continua alcançável pelo teclado (o foco aparece no botão).
 */
export function ModalFotoCampo({ foto, alt, vazio, forma = 'tile', comprimindo, erro, hint, onSelecionar, onRemover }: ModalFotoCampoProps) {
  return (
    <>
      <div className={`sys-modal__photo sys-modal__photo--${forma}`}>
        {foto ? <img className="sys-modal__photo-img" src={foto} alt={alt} /> : vazio}
      </div>

      <div className="sys-modal__photo-actions">
        <label
          className="sys-btn sys-btn--secondary sys-btn--sm sys-modal__photo-btn"
          aria-disabled={comprimindo || undefined}
          style={{ cursor: comprimindo ? 'wait' : 'pointer' }}
        >
          {comprimindo ? 'Processando...' : foto ? 'Trocar foto' : 'Adicionar foto'}
          <input className="sys-modal__photo-input" type="file" accept="image/*" onChange={onSelecionar} disabled={comprimindo} />
        </label>
        {foto && <Button variant="danger" size="sm" onClick={onRemover}>Remover foto</Button>}
      </div>

      {hint && <p className="sys-modal__photo-hint">{hint}</p>}
      {erro && <ModalNotice tone="error" role="alert">{erro}</ModalNotice>}
    </>
  );
}

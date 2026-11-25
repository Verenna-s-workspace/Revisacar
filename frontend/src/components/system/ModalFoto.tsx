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

export interface ModalFotoGradeProps {
  fotos: { src: string; name: string }[];
  /** Limite de fotos: com o limite atingido, o botão de adicionar fica desabilitado. */
  max?: number;
  comprimindo?: boolean;
  onAdicionar: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemover: (indice: number) => void;
  /** Abrir a foto em tela cheia (Lightbox). */
  onAmpliar: (src: string) => void;
}

/** Várias fotos: botão "Adicionar" + miniaturas quadradas com remover. Para galerias dentro de modais. */
export function ModalFotoGrade({ fotos, max, comprimindo, onAdicionar, onRemover, onAmpliar }: ModalFotoGradeProps) {
  const cheio = max !== undefined && fotos.length >= max;
  const desabilitado = !!comprimindo || cheio;
  return (
    <div className="sys-modal__grade">
      <label className="sys-modal__grade-add" aria-disabled={desabilitado || undefined} style={{ cursor: desabilitado ? 'not-allowed' : 'pointer' }}>
        <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <rect x="1.5" y="4" width="15" height="11" rx="2" />
          <circle cx="9" cy="9.5" r="2.8" />
          <path d="M6 4l1.2-2h3.6L12 4" />
        </svg>
        <span>{comprimindo ? 'Processando...' : cheio ? 'Limite' : 'Adicionar'}</span>
        <input className="sys-modal__photo-input" type="file" accept="image/*" multiple onChange={onAdicionar} disabled={desabilitado} />
      </label>

      {fotos.map((f, i) => (
        <div key={i} className="sys-modal__grade-item">
          <button type="button" className="sys-modal__grade-img" onClick={() => onAmpliar(f.src)} aria-label={`Ampliar foto ${i + 1}`}>
            <img src={f.src} alt={f.name} />
          </button>
          <button type="button" className="sys-modal__grade-x" onClick={() => onRemover(i)} aria-label={`Remover foto ${i + 1}`}>
            <svg width="10" height="10" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <line x1="1" y1="1" x2="7" y2="7" /><line x1="7" y1="1" x2="1" y2="7" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

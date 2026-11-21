import { createContext, useContext, useEffect, useId, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './modal.css';

/**
 * ═══ Padrão de modal do RevisaCar ═══════════════════════════════════════════
 * Nasceu no modal de produto do Estoque. Toda janela nova (ou migrada) monta
 * as mesmas peças, nesta ordem — só o conteúdo muda:
 *
 *   <Modal size="xl" onClose={…} onSubmit={…}>           ← fundo + janela (vira <form> com onSubmit)
 *     <ModalHeader icon title description meta />        ← ícone · título · descrição · selo (ModalBadge) · fechar
 *     <ModalBody>                                        ← rola sozinho; fundo cinza-claro
 *       <ModalColumns aside={…}>                         ← (opcional) coluna lateral + principal
 *         <ModalHighlights>                              ← (opcional) cartões de valor em destaque
 *           <ModalHighlight label icon hint>…</ModalHighlight>
 *         </ModalHighlights>
 *         <ModalSection icon title description tone>     ← cartão branco com título e divisor
 *           <ModalFields>…campos…</ModalFields>          ← grade de campos (2 colunas, quebra sozinha)
 *         </ModalSection>
 *       </ModalColumns>
 *     </ModalBody>
 *     <ModalFooter hint notice>                          ← divisor · aviso/erro · Cancelar + ação principal
 *       <Button variant="ghost">Cancelar</Button>
 *       <Button variant="primary" type="submit">Salvar</Button>
 *     </ModalFooter>
 *   </Modal>
 *
 * Medidas (px): janela raio 12 · cabeçalho 20/24 · corpo 24, 16 entre cartões ·
 * cartão raio 8, padding 20, 16 entre campos · rodapé 16/24 · botões e campos 36, raio 6.
 * Tamanhos: sm 440 · md 560 · lg 720 · xl 960. Um botão primário por modal.
 * Cores e tipografia: ver modal.css (mesma paleta de Ordens, Atendimento e Estoque).
 */

interface ModalContextValue { titleId: string; onClose: () => void }
const ModalContext = createContext<ModalContextValue | null>(null);

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── Janela ───────────────────────────────────────────────────────────────────

export interface ModalProps {
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Com onSubmit a janela inteira vira um <form>: o botão type="submit" do rodapé envia. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  /** Clicar fora fecha (padrão). Desligue em formulários longos se perder dados for um risco. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Fundo + janela. Esc e clique fora fecham; o foco entra na janela, fica preso
 * nela (Tab circula) e volta pro elemento de origem ao fechar; a página atrás não rola.
 */
export function Modal({ onClose, size = 'lg', onSubmit, closeOnBackdrop = true, children }: ModalProps) {
  const titleId = useId();
  const janelaRef = useRef<HTMLElement | null>(null);
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;

  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null;
    janelaRef.current?.focus({ preventScroll: true });

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { fecharRef.current(); return; }
      if (e.key !== 'Tab' || !janelaRef.current) return;
      const itens = Array.from(janelaRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(el => el.offsetParent !== null);
      if (itens.length === 0) { e.preventDefault(); return; }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || ativo === janelaRef.current)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      origem?.focus?.({ preventScroll: true });
    };
  }, []);

  const props = {
    ref: janelaRef as never,
    className: `sys-modal sys-modal--${size}`,
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
    tabIndex: -1,
  };

  return (
    <ModalContext.Provider value={{ titleId, onClose }}>
      <div
        className="sys-modal-backdrop"
        onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
      >
        {onSubmit
          ? <form {...props} onSubmit={onSubmit}>{children}</form>
          : <div {...props}>{children}</div>}
      </div>
    </ModalContext.Provider>
  );
}

// ── Cabeçalho ────────────────────────────────────────────────────────────────

export interface ModalHeaderProps {
  title: string;
  description?: ReactNode;
  /** Ícone num quadrado ao lado do título. */
  icon?: ReactNode;
  /** Selo/estado ao lado do título (ex.: "Quarentena"). */
  meta?: ReactNode;
}

const IconeFechar = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export function ModalHeader({ title, description, icon, meta }: ModalHeaderProps) {
  const ctx = useContext(ModalContext);
  return (
    <header className="sys-modal__header">
      {icon && <span className="sys-modal__header-icon" aria-hidden="true">{icon}</span>}
      <div className="sys-modal__header-text">
        <div className="sys-modal__title-row">
          <h2 id={ctx?.titleId} className="sys-modal__title">{title}</h2>
          {meta}
        </div>
        {description && <p className="sys-modal__description">{description}</p>}
      </div>
      <button type="button" className="sys-modal__close" aria-label="Fechar" onClick={ctx?.onClose}>
        {IconeFechar}
      </button>
    </header>
  );
}

/** Selo pequeno de estado, pensado para o `meta` do cabeçalho (mesma paleta dos avisos). */
export function ModalBadge({ tone = 'info', children }: { tone?: 'info' | 'attention' | 'error'; children: ReactNode }) {
  return (
    <span className={`sys-modal__badge sys-modal__badge--${tone}`}>
      <span className="sys-modal__badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

// ── Corpo e colunas ──────────────────────────────────────────────────────────

/** Área que rola. Cabeçalho e rodapé ficam sempre visíveis. */
export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="sys-modal__body">{children}</div>;
}

/**
 * Coluna lateral (ex.: foto) + coluna principal. A principal vem primeiro no DOM — é por ela que o
 * Tab começa (os campos que a pessoa preenche) — e a lateral aparece à esquerda só visualmente.
 * Em telas estreitas vira uma coluna só, com a lateral depois da principal.
 */
export function ModalColumns({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="sys-modal__columns">
      <div className="sys-modal__col">{children}</div>
      <div className="sys-modal__col sys-modal__col--aside">{aside}</div>
    </div>
  );
}

// ── Seção (cartão com título) ────────────────────────────────────────────────

export interface ModalSectionProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Algo à direita do título (ex.: um contador ou link). */
  aside?: ReactNode;
  /** attention = destaca a seção (ex.: quarentena ativa), com a cor de atenção. */
  tone?: 'default' | 'attention';
  children: ReactNode;
}

export function ModalSection({ title, description, icon, aside, tone = 'default', children }: ModalSectionProps) {
  return (
    <section className={`sys-modal__section${tone === 'attention' ? ' sys-modal__section--attention' : ''}`}>
      <div className="sys-modal__section-head">
        {icon && <span className="sys-modal__section-icon" aria-hidden="true">{icon}</span>}
        <div className="sys-modal__section-text">
          <h3 className="sys-modal__section-title">{title}</h3>
          {description && <p className="sys-modal__section-desc">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="sys-modal__section-body">{children}</div>
    </section>
  );
}

/** Grade de campos: duas colunas que quebram sozinhas quando falta espaço. */
export function ModalFields({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return <div className={`sys-modal__fields${columns === 1 ? ' sys-modal__fields--single' : ''}`}>{children}</div>;
}

// ── Cartões de destaque (valores-chave, ex.: quantidade / mínimo / preço) ────

export function ModalHighlights({ children }: { children: ReactNode }) {
  return <div className="sys-modal__highlights">{children}</div>;
}

export interface ModalHighlightProps {
  label: string;
  /** id do campo dentro do cartão (liga o rótulo ao campo). */
  htmlFor: string;
  icon?: ReactNode;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function ModalHighlight({ label, htmlFor, icon, required, hint, children }: ModalHighlightProps) {
  return (
    <div className="sys-modal__highlight">
      <label className="sys-modal__highlight-label" htmlFor={htmlFor}>
        {icon && <span className="sys-modal__highlight-icon" aria-hidden="true">{icon}</span>}
        {label}
        {required && <span className="sys-modal__required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p className="sys-modal__highlight-hint">{hint}</p>}
    </div>
  );
}

// ── Aviso ────────────────────────────────────────────────────────────────────

export interface ModalNoticeProps {
  /** info = neutro · attention = âmbar · error = rosa-avermelhado (mesma paleta dos status da OS). */
  tone?: 'info' | 'attention' | 'error';
  title?: string;
  role?: 'alert' | 'status';
  children: ReactNode;
}

export function ModalNotice({ tone = 'info', title, role, children }: ModalNoticeProps) {
  return (
    <div className={`sys-modal__notice sys-modal__notice--${tone}`} role={role}>
      {title && <div className="sys-modal__notice-title">{title}</div>}
      <div className="sys-modal__notice-text">{children}</div>
    </div>
  );
}

// ── Interruptor (liga/desliga um estado) ─────────────────────────────────────

export interface ModalSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ModalSwitch({ label, description, checked, onChange, disabled }: ModalSwitchProps) {
  return (
    <label className="sys-modal__switch">
      <span className="sys-modal__switch-text">
        <span className="sys-modal__switch-label">{label}</span>
        {description && <span className="sys-modal__switch-desc">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="sys-modal__switch-input"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="sys-modal__switch-track" aria-hidden="true" />
    </label>
  );
}

// ── Rodapé ───────────────────────────────────────────────────────────────────

export interface ModalFooterProps {
  /** Texto discreto à esquerda (ex.: "* Campos obrigatórios"). */
  hint?: ReactNode;
  /** Aviso/erro acima dos botões — use <ModalNotice tone="error" role="alert">. */
  notice?: ReactNode;
  /** Botões: ação secundária (ghost) primeiro, ação principal (primary) por último. */
  children: ReactNode;
}

export function ModalFooter({ hint, notice, children }: ModalFooterProps) {
  return (
    <footer className="sys-modal__footer">
      {notice && <div className="sys-modal__footer-notice">{notice}</div>}
      <div className="sys-modal__footer-row">
        <div className="sys-modal__footer-hint">{hint}</div>
        <div className="sys-modal__actions">{children}</div>
      </div>
    </footer>
  );
}

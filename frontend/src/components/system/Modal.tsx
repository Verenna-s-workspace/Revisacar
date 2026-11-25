import { createContext, useContext, useEffect, useId, useRef } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
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
 * Modo leitura (modais de detalhes): troque os campos por ModalValue (em ModalHighlight), ModalDetails/ModalDetail
 * e ModalRows/ModalRow — o resto da estrutura é idêntico, então ver e editar ficam parecidos.
 *
 * Medidas (px): janela raio 12 · cabeçalho 20/24 · corpo 24, 16 entre cartões ·
 * cartão raio 8, padding 20, 16 entre campos · rodapé 16/24 · botões e campos 36, raio 6.
 * Tamanhos: sm 440 · md 560 · lg 720 · xl 960. Um botão primário por modal.
 * Cores e tipografia: ver modal.css (mesma paleta de Ordens, Atendimento e Estoque).
 */

interface ModalContextValue { titleId: string; onClose: () => void }
const ModalContext = createContext<ModalContextValue | null>(null);

/**
 * Pilha de modais abertos. Só o do topo reage a Esc e Tab — sem isso, um modal de confirmação
 * aberto por cima de outro (ex.: useConfirm dentro de um modal) fecharia os dois no Esc
 * e os dois "prenderiam" o foco ao mesmo tempo.
 */
const pilhaDeModais: object[] = [];

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
  /** alertdialog = pede uma decisão (confirmações). Leitores de tela leem o conteúdo na hora. */
  role?: 'dialog' | 'alertdialog';
  /** Quem recebe o foco ao abrir. Padrão: a própria janela. Confirmações destrutivas focam em "Cancelar". */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** id do texto que descreve a janela (aria-describedby). */
  describedBy?: string;
  children: ReactNode;
}

/**
 * Fundo + janela. Esc e clique fora fecham; o foco entra na janela, fica preso
 * nela (Tab circula) e volta pro elemento de origem ao fechar; a página atrás não rola.
 */
export function Modal({ onClose, size = 'lg', onSubmit, closeOnBackdrop = true, role = 'dialog', initialFocusRef, describedBy, children }: ModalProps) {
  const titleId = useId();
  const janelaRef = useRef<HTMLElement | null>(null);
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;
  // Quem tinha o foco (o botão que abriu o modal) é lido na 1ª renderização, antes de qualquer filho montar:
  // um campo com `autoFocus` já teria tomado o foco quando o efeito roda.
  const origemRef = useRef<HTMLElement | null>(typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);

  useEffect(() => {
    const origem = origemRef.current;
    const eu = {};
    pilhaDeModais.push(eu);
    // Foco inicial: o alvo pedido; senão a janela — a menos que um campo (autoFocus) já esteja com o foco.
    const janela = janelaRef.current;
    if (initialFocusRef?.current) initialFocusRef.current.focus({ preventScroll: true });
    else if (janela && !janela.contains(document.activeElement)) janela.focus({ preventScroll: true });

    const aoTeclar = (e: KeyboardEvent) => {
      if (pilhaDeModais[pilhaDeModais.length - 1] !== eu) return;
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
      const i = pilhaDeModais.indexOf(eu);
      if (i >= 0) pilhaDeModais.splice(i, 1);
      origem?.focus?.({ preventScroll: true });
    };
  }, []);

  const props = {
    ref: janelaRef as never,
    className: `sys-modal sys-modal--${size}`,
    role,
    'aria-modal': true,
    'aria-labelledby': titleId,
    'aria-describedby': describedBy,
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
  /** error = ícone em tom crítico (confirmações de exclusão). */
  iconTone?: 'default' | 'error';
  /** Selo/estado ao lado do título (ex.: "Quarentena"). */
  meta?: ReactNode;
}

const IconeFechar = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export function ModalHeader({ title, description, icon, iconTone = 'default', meta }: ModalHeaderProps) {
  const ctx = useContext(ModalContext);
  return (
    <header className="sys-modal__header">
      {icon && <span className={`sys-modal__header-icon${iconTone === 'error' ? ' sys-modal__header-icon--error' : ''}`} aria-hidden="true">{icon}</span>}
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
export function ModalBadge({ tone = 'info', children }: { tone?: 'info' | 'attention' | 'error' | 'success'; children: ReactNode }) {
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
 * Coluna lateral (ex.: foto) + coluna principal. Em telas estreitas vira uma coluna só.
 * Formulário (padrão): a principal vem primeiro no DOM — é por ela que o Tab começa — e a lateral
 * aparece à esquerda só visualmente (em tela estreita, depois da principal).
 * `asideFirst` (modais de leitura): a lateral vem primeiro também em tela estreita (a foto abre o modal).
 */
export function ModalColumns({ aside, children, asideFirst }: { aside: ReactNode; children: ReactNode; asideFirst?: boolean }) {
  const lateral = <div className="sys-modal__col sys-modal__col--aside">{aside}</div>;
  const principal = <div className="sys-modal__col">{children}</div>;
  return (
    <div className={`sys-modal__columns${asideFirst ? ' sys-modal__columns--aside-first' : ''}`}>
      {asideFirst ? <>{lateral}{principal}</> : <>{principal}{lateral}</>}
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

/**
 * Item repetível dentro de uma seção (ex.: "Veículo 1", "Componente 2") com botão de remover.
 * Cartão com fundo do painel, para se distinguir da seção branca que o contém.
 */
export function ModalSubsection({ title, onRemove, removeLabel = 'Remover', children }: {
  title: string; onRemove?: () => void; removeLabel?: string; children: ReactNode;
}) {
  return (
    <div className="sys-modal__sub">
      <div className="sys-modal__sub-head">
        <h4 className="sys-modal__sub-title">{title}</h4>
        {onRemove && (
          <button type="button" className="sys-modal__sub-remove" onClick={onRemove} aria-label={`${removeLabel} ${title}`}>
            {removeLabel}
          </button>
        )}
      </div>
      {children}
    </div>
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
  /** id do campo dentro do cartão (liga o rótulo ao campo). Sem ele (modo leitura) o rótulo vira texto. */
  htmlFor?: string;
  icon?: ReactNode;
  required?: boolean;
  hint?: string;
  /** error = valor em alerta (ex.: estoque baixo), com a cor de erro dos status da OS. */
  tone?: 'default' | 'error';
  children: ReactNode;
}

export function ModalHighlight({ label, htmlFor, icon, required, hint, tone = 'default', children }: ModalHighlightProps) {
  const rotulo = (
    <>
      {icon && <span className="sys-modal__highlight-icon" aria-hidden="true">{icon}</span>}
      {label}
      {required && <span className="sys-modal__required" aria-hidden="true"> *</span>}
    </>
  );
  return (
    <div className={`sys-modal__highlight${tone === 'error' ? ' sys-modal__highlight--error' : ''}`}>
      {htmlFor
        ? <label className="sys-modal__highlight-label" htmlFor={htmlFor}>{rotulo}</label>
        : <div className="sys-modal__highlight-label">{rotulo}</div>}
      {children}
      {hint && <p className="sys-modal__highlight-hint">{hint}</p>}
    </div>
  );
}

/** Valor em destaque dentro de um ModalHighlight, no modo leitura (no lugar do campo). */
export function ModalValue({ children }: { children: ReactNode }) {
  return <p className="sys-modal__value">{children}</p>;
}

// ── Modo leitura: pares rótulo/valor e linhas de lista ───────────────────────

/** Grade de pares rótulo/valor (modais de detalhes). Duas colunas que viram uma em telas estreitas. */
export function ModalDetails({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return <dl className={`sys-modal__details${columns === 1 ? ' sys-modal__details--single' : ''}`}>{children}</dl>;
}

/** Um par rótulo/valor. Valor vazio aparece como "—". `wide` ocupa a linha inteira (textos longos); `mono` para placa, chassi e códigos. */
export function ModalDetail({ label, children, wide, mono }: { label: string; children?: ReactNode; wide?: boolean; mono?: boolean }) {
  const vazio = children === undefined || children === null || children === '' || children === false;
  return (
    <div className={`sys-modal__detail${wide ? ' sys-modal__detail--wide' : ''}`}>
      <dt className="sys-modal__detail-label">{label}</dt>
      <dd className={`sys-modal__detail-value${vazio ? ' sys-modal__detail-value--vazio' : ''}${mono && !vazio ? ' sys-modal__mono' : ''}`}>{vazio ? '—' : children}</dd>
    </div>
  );
}

/** Lista de linhas separadas por divisores (ex.: componentes de um kit). */
export function ModalRows({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className="sys-modal__rows" aria-label={label}>{children}</ul>;
}

export interface ModalRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Conteúdo à direita (quantidade, selo…). */
  aside?: ReactNode;
  /** Imagem/ícone à esquerda. */
  leading?: ReactNode;
  /** Torna a linha clicável (abre o item). Sem isto, a linha é só leitura. */
  onSelect?: () => void;
}

export function ModalRow({ title, subtitle, aside, leading, onSelect }: ModalRowProps) {
  const conteudo = (
    <>
      {leading}
      <div className="sys-modal__row-text">
        <span className="sys-modal__row-title">{title}</span>
        {subtitle && <span className="sys-modal__row-subtitle">{subtitle}</span>}
      </div>
      {aside && <div className="sys-modal__row-aside">{aside}</div>}
    </>
  );
  if (!onSelect) return <li className="sys-modal__row">{conteudo}</li>;
  return (
    <li className="sys-modal__row sys-modal__row--action">
      <button type="button" className="sys-modal__row-btn" onClick={onSelect}>{conteudo}</button>
    </li>
  );
}

// ── Abas ─────────────────────────────────────────────────────────────────────

export interface ModalTabsProps<T extends string> {
  /** Nome do conjunto de abas (leitor de tela). */
  label: string;
  value: T;
  tabs: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}

/** Abas entre o cabeçalho e o corpo. Setas, Home e End trocam de aba. */
export function ModalTabs<T extends string>({ label, value, tabs, onChange }: ModalTabsProps<T>) {
  const base = useId();
  // A aba ativa nunca fica fora da tela (ex.: ao avançar por botões "Próximo" fora das abas).
  useEffect(() => {
    document.getElementById(`${base}-${value}`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [base, value]);
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex(t => t.value === value);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[n].value);
    document.getElementById(`${base}-${tabs[n].value}`)?.focus();
  };
  return (
    <div className="sys-modal__tabs" role="tablist" aria-label={label} onKeyDown={aoTeclar}>
      {tabs.map(t => (
        <button
          key={t.value}
          id={`${base}-${t.value}`}
          type="button"
          role="tab"
          className="sys-modal__tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
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

// ── Escolha única (chips) ────────────────────────────────────────────────────

export interface ModalChoicesProps<T extends string> {
  /** Rótulo visível do grupo (ex.: "Categoria"). */
  label: string;
  value: T;
  /** `dot`: cor (CSS) de uma bolinha antes do rótulo — ex.: a cor do status. */
  options: { value: T; label: string; dot?: string }[];
  onChange: (value: T) => void;
  /** Alvos de toque maiores (48px) — para telas usadas com uma mão, como o checklist. */
  touch?: boolean;
  /** Mostra a escolha atual, mas não deixa trocar (ex.: o tipo de um lançamento já criado). */
  disabled?: boolean;
}

/** Grupo de chips de escolha única (filtros, motivos). Um chip fica marcado; clicar em outro troca. */
export function ModalChoices<T extends string>({ label, value, options, onChange, touch, disabled }: ModalChoicesProps<T>) {
  const rotuloId = useId();
  return (
    <div className="sys-modal__choice-group">
      <div id={rotuloId} className="sys-modal__choice-label">{label}</div>
      <div className={`sys-modal__choices${touch ? ' sys-modal__choices--touch' : ''}`} role="group" aria-labelledby={rotuloId}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className={`sys-modal__choice${o.dot ? ' sys-modal__choice--dot' : ''}`}
            style={o.dot ? ({ '--dot': o.dot } as CSSProperties) : undefined}
            aria-pressed={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Rodapé ───────────────────────────────────────────────────────────────────

export interface ModalFooterProps {
  /** À esquerda dos botões. Texto simples ("* Campos obrigatórios") some no celular; um elemento
   *  (botão "Limpar filtros", progresso, PDF) aparece sempre, numa linha acima das ações. */
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
        {typeof hint === 'string' || hint == null || hint === false
          ? <div className="sys-modal__footer-hint">{hint}</div>
          : <div className="sys-modal__footer-extra">{hint}</div>}
        <div className="sys-modal__actions">{children}</div>
      </div>
    </footer>
  );
}

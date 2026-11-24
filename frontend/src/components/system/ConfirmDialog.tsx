import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconeAlerta } from './icons';
import './system.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** O que acontece / o que será perdido. Aceita quebras de linha. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (#9F1239 com ícone); primary = confirmação comum. */
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação único do app (substitui window.confirm e os 4 modais de exclusão).
 * Padrão: ícone crítico · título “Excluir a OS #…?” · o que será perdido · Cancelar + ação.
 * Foco inicial em “Cancelar”; Esc e clique fora cancelam.
 */
export function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  tone = 'primary', loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const perigo = tone === 'danger';

  return (
    <div className="sys-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sys-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sys-dialog-title"
           aria-describedby={description ? 'sys-dialog-text' : undefined}>
        {perigo && <div className="sys-dialog__icon">{IconeAlerta}</div>}
        <h2 id="sys-dialog-title" className="sys-dialog__title">{title}</h2>
        {description && <p id="sys-dialog-text" className="sys-dialog__text">{description}</p>}
        <div className="sys-dialog__actions">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={perigo ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ── useConfirm: troca direta de `window.confirm` ────────────────────────────
// const confirmar = useConfirm();
// if (!(await confirmar({ title: 'Excluir a OS?', description: '…', confirmLabel: 'Excluir', tone: 'danger' }))) return;

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

type Pedir = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Pedir | null>(null);

/** Fica uma vez só, na raiz (main.tsx), ao lado do ToastProvider. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<(ConfirmOptions & { resolver: (v: boolean) => void }) | null>(null);

  const pedir = useCallback<Pedir>((opts) => new Promise<boolean>((resolver) => setPedido({ ...opts, resolver })), []);
  const fechar = useCallback((v: boolean) => {
    setPedido((atual) => { atual?.resolver(v); return null; });
  }, []);

  return (
    <ConfirmContext.Provider value={pedir}>
      {children}
      <ConfirmDialog
        open={!!pedido}
        title={pedido?.title ?? ''}
        description={pedido?.description}
        confirmLabel={pedido?.confirmLabel}
        cancelLabel={pedido?.cancelLabel}
        tone={pedido?.tone}
        onConfirm={() => fechar(true)}
        onCancel={() => fechar(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Pedir {
  const ctx = useContext(ConfirmContext);
  // Sem provider (ex.: página pública), cai no confirm nativo em vez de quebrar.
  return ctx ?? ((opts) => Promise.resolve(window.confirm([opts.title, opts.description].filter((x) => typeof x === 'string').join('\n\n'))));
}

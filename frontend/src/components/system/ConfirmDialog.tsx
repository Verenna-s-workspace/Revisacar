import { createContext, useCallback, useContext, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconeAlerta } from './icons';
import { Modal, ModalBody, ModalFooter, ModalHeader, ModalNotice } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** O que acontece / o que será perdido. Aceita quebras de linha. */
  description?: ReactNode;
  /** Aviso extra abaixo do texto (ex.: "Os veículos vinculados continuam cadastrados"). */
  notice?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (ícone crítico + botão sólido); primary = confirmação comum. */
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmação único do app. É o `Modal` do sistema em tamanho `sm`, então tem o mesmo visual
 * do modal de produto (cabeçalho com ícone · corpo · rodapé) e o mesmo comportamento: foco preso,
 * Esc e clique fora cancelam, vira bottom sheet no celular.
 * Foco inicial em “Cancelar” (evita confirmar uma exclusão sem querer com Enter).
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  return <ConfirmJanela {...props} />;
}

function ConfirmJanela({
  title, description, notice, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  tone = 'primary', loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const descId = useId();
  const perigo = tone === 'danger';

  return (
    <Modal
      size="sm"
      role="alertdialog"
      initialFocusRef={cancelRef}
      describedBy={description ? descId : undefined}
      closeOnBackdrop={!loading}
      onClose={() => { if (!loading) onCancel(); }}
    >
      <ModalHeader
        title={title}
        icon={perigo ? IconeAlerta : undefined}
        iconTone={perigo ? 'error' : 'default'}
      />
      {(description || notice) && (
        <ModalBody>
          <div className="sys-modal__confirm">
            {description && <p id={descId} className="sys-modal__confirm-text">{description}</p>}
            {notice && <ModalNotice tone="info">{notice}</ModalNotice>}
          </div>
        </ModalBody>
      )}
      <ModalFooter>
        <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button
          variant={perigo ? 'danger' : 'primary'}
          className={perigo ? 'sys-btn--solid' : undefined}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ── ConfirmDeleteDialog: confirmar exclusão de qualquer cadastro ────────────
// Substitui os DeleteConfirmModal de Veículos, Clientes e Serviços e o ConfirmDeleteModal do Estoque.
// <ConfirmDeleteDialog entidade="cliente" nome={c.nome} onConfirm={() => excluir(c.id)} onClose={() => setAlvo(null)} />

export interface ConfirmDeleteDialogProps {
  /** Encaixa em "excluir o <entidade>": use substantivo masculino, minúsculo (cliente, veículo, serviço, produto, kit). */
  entidade: string;
  /** O que está sendo excluído, em destaque na pergunta. */
  nome: ReactNode;
  /** Aviso extra (ex.: o que NÃO será apagado junto). */
  notice?: ReactNode;
  /** Pode ser assíncrono. O diálogo fecha ao terminar; erros devem ser tratados por quem passa a função. */
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
}

export function ConfirmDeleteDialog({ entidade, nome, notice, onConfirm, onClose }: ConfirmDeleteDialogProps) {
  const [excluindo, setExcluindo] = useState(false);

  async function confirmar() {
    if (excluindo) return;
    setExcluindo(true);
    try { await onConfirm(); } finally { onClose(); }
  }

  return (
    <ConfirmDialog
      open
      tone="danger"
      title={`Excluir ${entidade}?`}
      description={<>Tem certeza que deseja excluir o {entidade} <strong>{nome}</strong>? Esta ação não pode ser desfeita.</>}
      notice={notice}
      confirmLabel="Excluir"
      loading={excluindo}
      onConfirm={confirmar}
      onCancel={onClose}
    />
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

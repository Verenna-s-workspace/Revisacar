import { useEffect, useState } from 'react';
import { tokens } from '../../../../../constants';
import { btnAccent, btnGhost } from '../../../../../components/ui';
import {
  MOTIVO_MAX, MOTIVOS_PADRAO, validarMotivo,
} from '../../../../../utils/fotos_obrigatorias';

interface PularFotoSheetProps {
  rotulo: string;
  /** Motivo já registrado (ao alterar). */
  motivoAtual?: string;
  ocupado?: boolean;
  /** Erro vindo do servidor ao confirmar. */
  erro?: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}

const OUTRO = '__outro__';

/** Folha na base da tela: motivo curto de "Não consigo tirar esta foto" (atalhos ou texto livre). */
export function PularFotoSheet({ rotulo, motivoAtual, ocupado, erro, onConfirmar, onCancelar }: PularFotoSheetProps) {
  const inicialPadrao = motivoAtual && MOTIVOS_PADRAO.includes(motivoAtual) ? motivoAtual : '';
  const [escolha, setEscolha] = useState<string>(inicialPadrao || (motivoAtual ? OUTRO : ''));
  const [texto, setTexto] = useState(inicialPadrao ? '' : motivoAtual ?? '');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancelar]);

  const motivoFinal = escolha === OUTRO ? texto : escolha;
  const validacao = validarMotivo(motivoFinal);
  const podeConfirmar = !!escolha && validacao.ok && !ocupado;

  const chip = (ativo: boolean): React.CSSProperties => ({
    minHeight: 48,
    padding: '10px 16px',
    borderRadius: tokens.radius.lg,
    border: `1.5px solid ${ativo ? tokens.color.ferrari : tokens.color.borderMd}`,
    background: ativo ? tokens.color.accentDim : tokens.color.surface,
    color: ativo ? tokens.color.ferrari : tokens.color.text,
    fontFamily: tokens.fontSans,
    fontSize: '0.95rem',
    fontWeight: ativo ? 600 : 500,
    cursor: 'pointer',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Não consigo tirar a foto: ${rotulo}`}
      onClick={onCancelar}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(26,26,26,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: tokens.color.surface,
          borderRadius: `${tokens.radius.xl} ${tokens.radius.xl} 0 0`,
          padding: '18px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontFamily: tokens.fontSans, fontSize: '1.05rem', fontWeight: 700, color: tokens.color.text }}>
          Não consigo tirar esta foto
        </div>
        <div style={{ fontFamily: tokens.fontMono, fontSize: '0.72rem', color: tokens.color.muted, margin: '2px 0 14px' }}>
          {rotulo} — escolha o motivo
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MOTIVOS_PADRAO.map((m) => (
            <button key={m} type="button" style={chip(escolha === m)} onClick={() => setEscolha(m)} aria-pressed={escolha === m}>
              {m}
            </button>
          ))}
          <button type="button" style={chip(escolha === OUTRO)} onClick={() => setEscolha(OUTRO)} aria-pressed={escolha === OUTRO}>
            Outro motivo
          </button>
        </div>

        {escolha === OUTRO && (
          <div style={{ marginTop: 12 }}>
            <input
              autoFocus
              value={texto}
              maxLength={MOTIVO_MAX}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva o motivo (curto)"
              aria-label="Motivo"
              style={{
                width: '100%', minHeight: 48, boxSizing: 'border-box',
                padding: '10px 14px',
                fontSize: '1rem',            // 16px: o iPhone não dá zoom ao focar
                fontFamily: tokens.fontSans,
                color: tokens.color.text,
                background: tokens.color.bgAlt,
                border: `1.5px solid ${tokens.color.borderMd}`,
                borderRadius: tokens.radius.md,
              }}
            />
            <div style={{ fontFamily: tokens.fontMono, fontSize: '0.65rem', color: tokens.color.subtle, marginTop: 4, textAlign: 'right' }}>
              {texto.trim().length}/{MOTIVO_MAX}
            </div>
          </div>
        )}

        {erro && (
          <div role="alert" style={{ marginTop: 10, color: tokens.color.crit, fontSize: '0.85rem', fontFamily: tokens.fontSans }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => validacao.ok && onConfirmar(validacao.motivo)}
            style={{
              ...btnAccent, justifyContent: 'center', minHeight: 48, fontSize: '0.8rem',
              opacity: podeConfirmar ? 1 : 0.45, cursor: podeConfirmar ? 'pointer' : 'not-allowed',
            }}
          >
            {ocupado ? 'Registrando…' : 'Confirmar motivo'}
          </button>
          <button type="button" onClick={onCancelar} style={{ ...btnGhost, justifyContent: 'center', minHeight: 48, fontSize: '0.8rem' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

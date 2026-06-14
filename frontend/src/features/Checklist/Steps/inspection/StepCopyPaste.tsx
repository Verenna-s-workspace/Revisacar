import { useState, useRef, useEffect } from 'react';
import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { tokens } from '../../../../constants';
import {
  FormBlock, PanelFooter,
  btnGhost, btnSolid, pfNote,
  useResponsive,
} from '../../../../components/ui';

interface StepProps {
  os: ReturnType<typeof useOrdemServico>;
  onExportPDF?: () => void;
}

function StepWrapper({ children, direction = 'forward' }: {
  children: React.ReactNode;
  direction?: 'forward' | 'back';
}) {
  return (
    <div
      className={direction === 'forward' ? 'step-enter' : 'step-enter-left'}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </div>
  );
}

// ── Generate text from tabelaPecas ────────────────────────────────────────────

function buildText(pecas: ReturnType<typeof useOrdemServico>['tabelaPecas']): string {
  if (pecas.length === 0) return '';
  const lines: string[] = ['Peças:'];
  for (const p of pecas) {
    lines.push('');
    if (p.peca)       lines.push(`Peça: ${p.peca}`);
    if (p.modelo)     lines.push(`Modelo: ${p.modelo}`);
    if (p.marca)      lines.push(`Marca: ${p.marca}`);
    if (p.codigo)     lines.push(`Código: ${p.codigo}`);
    if (p.quantidade) lines.push(`Quantidade: ${p.quantidade}`);
  }
  return lines.join('\n');
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '52px 24px', gap: 14,
    }}>
      <svg width={48} height={48} viewBox="0 0 48 48" fill="none" stroke={tokens.color.ghost} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x={6} y={8} width={36} height={34} rx={3} />
        <path d="M14 18h20M14 25h20M14 32h12" />
        <path d="M36 2l-4 6M42 2l-4 6" strokeWidth={1.5} />
      </svg>
      <div style={{
        fontFamily: tokens.fontMono, fontSize: '0.72rem', color: tokens.color.ghost,
        textAlign: 'center', letterSpacing: '0.04em', lineHeight: 1.7,
      }}>
        Nenhuma peça cadastrada
        <br />
        <span style={{ fontSize: '0.62rem' }}>
          Volte à etapa anterior e preencha a tabela de peças
        </span>
      </div>
      <button onClick={onGoBack} style={{ ...btnGhost, marginTop: 4 }}>
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5H2M4.5 2l-3 3 3 3" />
        </svg>
        Voltar à tabela de peças
      </button>
    </div>
  );
}

// ── Preview Card — single part ─────────────────────────────────────────────

interface PreviewCardProps {
  peca: ReturnType<typeof useOrdemServico>['tabelaPecas'][number];
  index: number;
}

function PreviewCard({ peca, index }: PreviewCardProps) {
  const fields = [
    { label: 'Modelo',     value: peca.modelo },
    { label: 'Marca',      value: peca.marca },
    { label: 'Código',     value: peca.codigo },
    { label: 'Quantidade', value: peca.quantidade },
  ].filter((f) => f.value);

  const hasFields = fields.length > 0;

  return (
    <div style={{
      border: `1px solid ${tokens.color.border}`,
      borderRadius: tokens.radius.md,
      overflow: 'hidden',
      boxShadow: tokens.shadow.xs,
    }}>
      {/* Header */}
      <div style={{
        background: tokens.color.surfaceHigh,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: '9px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{
          fontFamily: tokens.fontMono, fontSize: '0.58rem', letterSpacing: '0.08em',
          color: tokens.color.ghost, minWidth: 22,
        }}>
          #{String(index + 1).padStart(2, '0')}
        </span>
        <span style={{
          fontFamily: tokens.fontSans, fontSize: '0.88rem', fontWeight: 500,
          color: tokens.color.text, flex: 1,
        }}>
          {peca.peca || <span style={{ color: tokens.color.ghost, fontStyle: 'italic' }}>Sem nome</span>}
        </span>
        {peca.isAuto && (
          <span style={{
            fontFamily: tokens.fontMono, fontSize: '0.48rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: tokens.color.ferrari,
            background: tokens.color.accentDim, border: `1px solid rgba(204,20,0,0.2)`,
            borderRadius: tokens.radius.full, padding: '1px 6px',
          }}>
            auto
          </span>
        )}
      </div>

      {/* Fields */}
      {hasFields ? (
        <div style={{
          background: tokens.color.surface,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 0,
        }}>
          {fields.map(({ label, value }, i) => (
            <div key={i} style={{
              padding: '9px 14px',
              borderRight: `1px solid ${tokens.color.border}`,
              borderBottom: `1px solid ${tokens.color.border}`,
            }}>
              <div style={{
                fontFamily: tokens.fontMono, fontSize: '0.52rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: tokens.color.subtle, marginBottom: 4,
              }}>
                {label}
              </div>
              <div style={{ fontFamily: tokens.fontSans, fontSize: '0.84rem', color: tokens.color.text }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: tokens.color.surface, padding: '11px 14px',
          fontFamily: tokens.fontMono, fontSize: '0.62rem', color: tokens.color.ghost,
          fontStyle: 'italic',
        }}>
          Campos não preenchidos
        </div>
      )}
    </div>
  );
}

// ── Step4 ─────────────────────────────────────────────────────────────────────

export function Step4({ os }: StepProps) {
  const {
    tabelaPecas,
    savedAt,
    saveOrder,
    goStep, step, stepDir,
  } = os;

  const { isMobile } = useResponsive();
  const [copied, setCopied]   = useState(false);
  const [editing, setEditing] = useState(false);
  const textAreaRef           = useRef<HTMLTextAreaElement>(null);

  const autoText    = buildText(tabelaPecas);
  const [editedText, setEditedText] = useState(autoText);

  // Sync when tabelaPecas changes (but only if user hasn't customised)
  const lastAutoRef = useRef(autoText);
  useEffect(() => {
    if (autoText !== lastAutoRef.current) {
      setEditedText(autoText);
      lastAutoRef.current = autoText;
      setEditing(false);
    }
  }, [autoText]);

  const displayText  = editedText;
  const isEmpty      = tabelaPecas.length === 0;
  const px           = isMobile ? 16 : 40;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for older browsers
      if (textAreaRef.current) {
        textAreaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    }
  }

  return (
    <StepWrapper direction={stepDir}>

      {/* ── Panel header ── */}
      <div style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: `18px ${px}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        boxShadow: tokens.shadow.xs,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: tokens.fontMono, fontSize: '0.62rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: tokens.color.subtle, marginBottom: 6,
          }}>
            Geração de texto
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontFamily: tokens.fontMono, fontSize: '1.8rem', fontWeight: 300, lineHeight: 1,
              color: tabelaPecas.length > 0 ? tokens.color.ferrari : tokens.color.ghost,
              letterSpacing: '-0.03em',
            }}>
              {tabelaPecas.length}
            </span>
            <span style={{ fontFamily: tokens.fontMono, fontSize: '0.65rem', color: tokens.color.muted }}>
              {tabelaPecas.length === 1 ? 'peça listada' : 'peças listadas'}
            </span>
          </div>
        </div>

        {!isEmpty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setEditing((e) => !e);
                if (!editing) {
                  setTimeout(() => textAreaRef.current?.focus(), 50);
                }
              }}
              style={{
                fontFamily: tokens.fontMono, fontSize: '0.62rem', letterSpacing: '0.05em',
                textTransform: 'uppercase', padding: '7px 16px', borderRadius: tokens.radius.md,
                border: `1px solid ${editing ? tokens.color.ferrari : tokens.color.border}`,
                background: editing ? tokens.color.accentDim : tokens.color.bgAlt,
                color: editing ? tokens.color.ferrari : tokens.color.muted,
                cursor: 'pointer', transition: tokens.transition.base,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width={11} height={11} viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.5 1.5l2 2L3 10H1v-2L7.5 1.5z" />
              </svg>
              {editing ? 'Modo edição' : 'Editar'}
            </button>
            <button
              onClick={() => { setEditedText(autoText); setEditing(false); }}
              title="Restaurar texto automático"
              style={{
                fontFamily: tokens.fontMono, fontSize: '0.62rem', letterSpacing: '0.05em',
                textTransform: 'uppercase', padding: '7px 14px', borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.color.border}`, background: 'transparent',
                color: tokens.color.subtle, cursor: 'pointer', transition: tokens.transition.base,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = tokens.color.textSecond; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = tokens.color.subtle; }}
            >
              <svg width={11} height={11} viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5.5A4.5 4.5 0 1 0 5.5 1" /><path d="M1 1v4.5H5.5" />
              </svg>
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: `28px ${px}px 0`, maxWidth: 1100, margin: '0 auto' }}>

        {isEmpty ? (
          <FormBlock title="Texto Automático">
            <EmptyState onGoBack={() => goStep(step - 1, step)} />
          </FormBlock>
        ) : (
          <>
            {/* ── Preview cards ── */}
            <FormBlock title="Prévia das Peças">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tabelaPecas.map((p, i) => (
                  <PreviewCard key={p.id} peca={p} index={i} />
                ))}
              </div>
            </FormBlock>

            {/* ── Text output ── */}
            <FormBlock title="Texto Gerado" noBorder>
              <div style={{
                border: `1px solid ${editing ? tokens.color.ferrari : tokens.color.border}`,
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
                boxShadow: editing ? `0 0 0 2px ${tokens.color.accentDim}` : tokens.shadow.xs,
                transition: 'border-color 0.18s, box-shadow 0.18s',
              }}>
                {/* Text output toolbar */}
                <div style={{
                  background: tokens.color.surfaceHigh,
                  borderBottom: `1px solid ${tokens.color.border}`,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <span style={{
                    fontFamily: tokens.fontMono, fontSize: '0.58rem', letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: tokens.color.subtle,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={tokens.color.subtle} strokeWidth={1.4} strokeLinecap="round">
                      <rect x={1} y={1} width={8} height={8} rx={1} /><path d="M3 4h4M3 6.5h2.5" />
                    </svg>
                    {editing ? 'Editando manualmente' : 'Gerado automaticamente'}
                  </span>
                  <button
                    onClick={copyToClipboard}
                    style={{
                      fontFamily: tokens.fontMono, fontSize: '0.6rem', fontWeight: 600,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      padding: '5px 14px', borderRadius: tokens.radius.sm,
                      border: `1px solid ${copied ? tokens.color.okBorder : tokens.color.border}`,
                      background: copied ? tokens.color.okBg : tokens.color.surface,
                      color: copied ? tokens.color.ok : tokens.color.muted,
                      cursor: 'pointer', transition: 'all 0.18s',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {copied ? (
                      <>
                        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke={tokens.color.ok} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" />
                        </svg>
                        Copiado!
                      </>
                    ) : (
                      <>
                        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                          <rect x={3} y={3} width={6} height={7} rx={1} /><path d="M1 7V1h6" />
                        </svg>
                        Copiar
                      </>
                    )}
                  </button>
                </div>

                {/* Textarea */}
                <textarea
                  ref={textAreaRef}
                  value={displayText}
                  readOnly={!editing}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={Math.max(8, displayText.split('\n').length + 2)}
                  style={{
                    width: '100%',
                    display: 'block',
                    fontFamily: tokens.fontMono,
                    fontSize: '0.85rem',
                    color: tokens.color.text,
                    background: editing ? tokens.color.surface : tokens.color.bgAlt,
                    border: 'none',
                    outline: 'none',
                    resize: editing ? 'vertical' : 'none',
                    padding: '18px 20px',
                    lineHeight: 1.85,
                    letterSpacing: '0.01em',
                    boxSizing: 'border-box',
                    cursor: editing ? 'text' : 'default',
                    transition: 'background 0.18s',
                  }}
                />
              </div>

              <p style={{
                fontFamily: tokens.fontMono, fontSize: '0.6rem', color: tokens.color.ghost,
                marginTop: 10, letterSpacing: '0.04em',
              }}>
                {editing
                  ? 'Modo edição ativo — alterações não afetam a tabela de peças'
                  : 'O texto é atualizado automaticamente quando a tabela de peças é editada'}
              </p>
            </FormBlock>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <PanelFooter
        left={
          <span style={pfNote}>
            {savedAt ? `Salvo às ${savedAt}` : 'Rascunho não salvo'}
          </span>
        }
        right={
          <>
            <button onClick={() => goStep(step - 1, step)} style={btnGhost}>
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={saveOrder} style={btnSolid}>
              Salvar
            </button>
            {!isEmpty && (
              <button onClick={copyToClipboard} style={{
                fontFamily: tokens.fontMono, fontSize: '0.72rem', fontWeight: 500,
                letterSpacing: '0.05em', textTransform: 'uppercase', padding: '9px 20px',
                borderRadius: tokens.radius.md, border: 'none', cursor: 'pointer',
                transition: tokens.transition.base, whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: copied ? tokens.color.ok : tokens.color.ferrari,
                color: '#fff',
                boxShadow: `0 1px 4px ${copied ? 'rgba(26,127,75,0.3)' : 'rgba(204,20,0,0.3)'}`,
              }}>
                {copied ? (
                  <>
                    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1.5,5 4,7.5 8.5,2.5" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                      <rect x={3} y={3} width={6} height={7} rx={1} /><path d="M1 7V1h6" />
                    </svg>
                    Copiar texto
                  </>
                )}
              </button>
            )}
          </>
        }
      />
    </StepWrapper>
  );
}

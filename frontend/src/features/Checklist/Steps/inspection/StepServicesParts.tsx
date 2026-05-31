import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { tokens } from '../../../../constants';
import type { TabelaPeca } from '../../../../types';
import {
  FormBlock, PanelFooter,
  btnGhost, btnAccent, btnSolid, btnDisabled, pfNote,
  useResponsive, inp,
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

// ── PartRow component ─────────────────────────────────────────────────────────

interface PartRowProps {
  row: TabelaPeca;
  isMobile: boolean;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
}

function PartRow({ row, isMobile, onUpdate, onRemove }: PartRowProps) {
  const cellInput = {
    fontFamily: tokens.fontSans,
    fontSize: '0.84rem',
    color: tokens.color.text,
    background: 'transparent',
    border: 'none',
    borderBottom: '1.5px solid transparent',
    outline: 'none',
    padding: '6px 2px',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  };

  const editableFields = [
    { key: 'modelo',     placeholder: 'Ex: HB20' },
    { key: 'marca',      placeholder: 'Ex: Bosch' },
    { key: 'codigo',     placeholder: 'Ex: F49FH2' },
    { key: 'quantidade', placeholder: '0', type: 'number' },
  ];

  const autoBadge = (
    <span style={{
      fontFamily: tokens.fontMono,
      fontSize: '0.50rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: tokens.color.ferrari,
      background: tokens.color.accentDim,
      border: `1px solid rgba(204,20,0,0.2)`,
      borderRadius: tokens.radius.full,
      padding: '1px 6px',
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      auto
    </span>
  );

  const removeBtn = (
    <button
      onClick={() => onRemove(row.id)}
      title="Remover linha"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: tokens.color.subtle,
        padding: '4px 6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tokens.radius.sm,
        transition: tokens.transition.fast,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color      = tokens.color.crit;
        e.currentTarget.style.background = tokens.color.critBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color      = tokens.color.subtle;
        e.currentTarget.style.background = 'none';
      }}
    >
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
        <path d="M2 2l8 8M10 2l-8 8" />
      </svg>
    </button>
  );

  if (isMobile) {
    return (
      <div style={{
        background: tokens.color.surface,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {/* Peça + remove header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {row.isAuto ? (
              <span style={{ fontFamily: tokens.fontSans, fontSize: '0.88rem', fontWeight: 500, color: tokens.color.text }}>
                {row.peca}
              </span>
            ) : (
              <input
                value={row.peca}
                onChange={(e) => onUpdate(row.id, 'peca', e.target.value)}
                placeholder="Nome da peça..."
                style={{ ...inp, fontSize: '0.86rem', padding: '6px 10px', fontWeight: 500 }}
              />
            )}
            {row.isAuto && autoBadge}
          </div>
          {removeBtn}
        </div>

        {/* Editable fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
          {editableFields.map(({ key, placeholder, type }) => (
            <div key={key}>
              <div style={{
                fontFamily: tokens.fontMono,
                fontSize: '0.52rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: tokens.color.subtle,
                marginBottom: 4,
              }}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </div>
              <input
                type={type || 'text'}
                value={row[key as keyof TabelaPeca] as string}
                onChange={(e) => onUpdate(row.id, key, e.target.value)}
                placeholder={placeholder}
                min={type === 'number' ? '0' : undefined}
                style={{ ...inp, fontSize: '0.83rem', padding: '6px 10px' }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop grid layout
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.6fr 1.1fr 1.1fr 1fr 0.7fr 44px',
      background: tokens.color.surface,
      alignItems: 'center',
    }}>
      {/* Peça (non-editable if auto) */}
      <div style={{ padding: '9px 14px', borderRight: `1px solid ${tokens.color.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        {row.isAuto ? (
          <span style={{ fontFamily: tokens.fontSans, fontSize: '0.84rem', color: tokens.color.text, fontWeight: 500 }}>
            {row.peca}
          </span>
        ) : (
          <input
            value={row.peca}
            onChange={(e) => onUpdate(row.id, 'peca', e.target.value)}
            placeholder="Nome da peça..."
            style={cellInput}
            onFocus={(e)  => e.currentTarget.style.borderBottomColor = tokens.color.ferrari}
            onBlur={(e)   => e.currentTarget.style.borderBottomColor = 'transparent'}
          />
        )}
        {row.isAuto && autoBadge}
      </div>

      {/* Modelo, Marca, Código, Quantidade */}
      {editableFields.map(({ key, placeholder, type }, i) => (
        <div key={key} style={{
          padding: '9px 14px',
          borderRight: i < editableFields.length - 1 ? `1px solid ${tokens.color.border}` : 'none',
        }}>
          <input
            type={type || 'text'}
            value={row[key as keyof TabelaPeca] as string}
            onChange={(e) => onUpdate(row.id, key, e.target.value)}
            placeholder={placeholder}
            min={type === 'number' ? '0' : undefined}
            style={cellInput}
            onFocus={(e)  => e.currentTarget.style.borderBottomColor = tokens.color.ferrari}
            onBlur={(e)   => e.currentTarget.style.borderBottomColor = 'transparent'}
          />
        </div>
      ))}

      {/* Remove */}
      <div style={{
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderLeft: `1px solid ${tokens.color.border}`,
        height: '100%',
      }}>
        {removeBtn}
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '52px 24px', gap: 14,
    }}>
      <svg width={48} height={48} viewBox="0 0 48 48" fill="none" stroke={tokens.color.ghost} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
        <rect x={6} y={10} width={36} height={30} rx={3} />
        <path d="M14 20h20M14 27h12M14 34h16" />
        <path d="M34 6l7 7M41 6l-7 7" strokeWidth={1.6} />
      </svg>
      <div style={{
        fontFamily: tokens.fontMono, fontSize: '0.72rem', color: tokens.color.ghost,
        textAlign: 'center', letterSpacing: '0.04em', lineHeight: 1.7,
      }}>
        Nenhuma peça marcada para troca
        <br />
        <span style={{ fontSize: '0.62rem' }}>
          Ative "Trocar" em itens do diagnóstico ou adicione manualmente abaixo
        </span>
      </div>
      <button onClick={onGoBack} style={{ ...btnGhost, marginTop: 4 }}>
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5H2M4.5 2l-3 3 3 3" />
        </svg>
        Voltar ao diagnóstico
      </button>
    </div>
  );
}

// ── Step3 ─────────────────────────────────────────────────────────────────────

export function Step3({ os }: StepProps) {
  const {
    tabelaPecas,
    updateTabelaPeca,
    addTabelaPecaManual,
    removeTabelaPeca,
    savedAt,
    saveOrder,
    goStep, step, stepDir,
  } = os;

  const { isMobile } = useResponsive();
  const autoCount   = tabelaPecas.filter((r) => r.isAuto).length;
  const manualCount = tabelaPecas.filter((r) => !r.isAuto).length;
  const px = isMobile ? 16 : 40;

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
            Peças para troca
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
              {tabelaPecas.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 28 }}>
          {autoCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: tokens.fontMono, fontSize: '1.2rem', fontWeight: 300, color: tokens.color.ferrari, display: 'block', lineHeight: 1 }}>
                {autoCount}
              </span>
              <span style={{ fontFamily: tokens.fontMono, fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: tokens.color.subtle, display: 'block', marginTop: 4 }}>
                Automático
              </span>
            </div>
          )}
          {manualCount > 0 && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: tokens.fontMono, fontSize: '1.2rem', fontWeight: 300, color: tokens.color.textSecond, display: 'block', lineHeight: 1 }}>
                {manualCount}
              </span>
              <span style={{ fontFamily: tokens.fontMono, fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: tokens.color.subtle, display: 'block', marginTop: 4 }}>
                Manual
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: `28px ${px}px 0`, maxWidth: 1100, margin: '0 auto' }}>
        <FormBlock title="Tabela de Peças para Troca">

          {tabelaPecas.length === 0 ? (
            <EmptyState onGoBack={() => goStep(step - 1, step)} />
          ) : (
            <div style={{
              border: `1px solid ${tokens.color.border}`,
              borderRadius: tokens.radius.lg,
              overflow: 'hidden',
              boxShadow: tokens.shadow.xs,
            }}>
              {/* Column headers — desktop only */}
              {!isMobile && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 1.1fr 1.1fr 1fr 0.7fr 44px',
                  background: tokens.color.surfaceHigh,
                  borderBottom: `1px solid ${tokens.color.border}`,
                  padding: '9px 14px',
                  gap: 0,
                }}>
                  {['Peça', 'Modelo', 'Marca', 'Código', 'Qtd.', ''].map((col, i) => (
                    <div key={i} style={{
                      fontFamily: tokens.fontMono, fontSize: '0.58rem', fontWeight: 500,
                      letterSpacing: '0.1em', textTransform: 'uppercase', color: tokens.color.subtle,
                      paddingRight: 14,
                    }}>
                      {col}
                    </div>
                  ))}
                </div>
              )}

              {/* Rows separated by 1px gaps */}
              <div style={{
                background: tokens.color.border,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}>
                {tabelaPecas.map((row) => (
                  <PartRow
                    key={row.id}
                    row={row}
                    isMobile={isMobile}
                    onUpdate={updateTabelaPeca}
                    onRemove={removeTabelaPeca}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add manual row button */}
          <button
            onClick={addTabelaPecaManual}
            style={{
              marginTop: 14,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: tokens.fontMono,
              fontSize: '0.62rem',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: tokens.color.muted,
              background: tokens.color.bgAlt,
              border: `1.5px dashed ${tokens.color.borderMd}`,
              borderRadius: tokens.radius.md,
              padding: '11px 18px',
              cursor: 'pointer',
              transition: tokens.transition.base,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tokens.color.ferrari;
              e.currentTarget.style.color       = tokens.color.ferrari;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = tokens.color.borderMd;
              e.currentTarget.style.color       = tokens.color.muted;
            }}
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            Adicionar peça manualmente
          </button>
        </FormBlock>
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
            <button
              onClick={() => goStep(step + 1, step)}
              disabled={tabelaPecas.length === 0}
              style={tabelaPecas.length === 0 ? btnDisabled : btnAccent}
            >
              Gerar Texto
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}

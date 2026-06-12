import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { SECTIONS, tokens } from '../../../../constants';
import {
  PanelFooter, StatBadge,
  btnSolid, btnGhost, btnAccent, pfNote,
} from '../../../../components/ui';
import { ChecklistSection } from './Checklist';

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

export function Step2({ os }: StepProps) {
  const {
    selected,
    checklist,
    stats,
    setChecklistStatus,
    setChecklistObs,
    itensAdicionais,
    addChecklistItem,
    removeChecklistItem,
    trocaSet,
    toggleTroca,
    savedAt,
    saveOrder,
    goStep, step, stepDir,
  } = os;

  const { done, total, ok, warn, crit } = stats;
  const progress = total ? (done / total) * 100 : 0;

  return (
    <StepWrapper direction={stepDir}>
      {/* Progress panel */}
      <div style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: '18px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 40,
        boxShadow: tokens.shadow.xs,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{
              fontFamily: tokens.fontMono,
              fontSize: '0.62rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: tokens.color.subtle,
            }}>
              Progresso da inspeção
            </span>
            <span style={{
              fontFamily: tokens.fontMono,
              fontSize: '0.62rem',
              color: tokens.color.muted,
            }}>
              {done} / {total} itens
            </span>
          </div>
          <div style={{
            height: 3,
            background: tokens.color.border,
            overflow: 'hidden',
            borderRadius: 2,
          }}>
            <div style={{
              height: '100%',
              background: crit > 0
                ? `linear-gradient(90deg, ${tokens.color.crit}, ${tokens.color.ferrariDark})`
                : `linear-gradient(90deg, ${tokens.color.ok}, #15803d)`,
              width: `${progress}%`,
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
              borderRadius: 2,
            }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 28 }}>
          <StatBadge value={ok}   label="OK"      color={tokens.color.ok} />
          <StatBadge value={warn} label="Atenção"  color={tokens.color.warn} />
          <StatBadge value={crit} label="Crítico"  color={tokens.color.crit} />
        </div>
      </div>

      <div style={{ padding: '28px 40px 0', maxWidth: 1100, margin: '0 auto' }}>
        {SECTIONS.filter((s) => selected.has(s.id)).map((sec) => (
          <ChecklistSection
            key={sec.id}
            sec={sec}
            checklist={checklist}
            onSetStatus={setChecklistStatus}
            onSetObs={setChecklistObs}
            itensAdicionais={itensAdicionais}
            onAddItem={addChecklistItem}
            onRemoveItem={removeChecklistItem}
            trocaSet={trocaSet}
            onToggleTroca={toggleTroca}
          />
        ))}
      </div>

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
            <button onClick={() => goStep(step + 1, step)} style={btnAccent}>
              Peças
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
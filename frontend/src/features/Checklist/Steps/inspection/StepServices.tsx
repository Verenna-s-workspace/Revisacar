import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { SECTIONS, tokens } from '../../../../constants';
import {
  FormBlock, PanelFooter, SectionIcon,
  btnGhost, btnAccent, btnDisabled, pfNote,
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

export function Step1({ os }: StepProps) {
  const {
    selected,
    toggleSection,
    toggleAllSections,
    goStep, step, stepDir,
  } = os;

  const allSelected = selected.size === SECTIONS.length;

  return (
    <StepWrapper direction={stepDir}>
      <FormBlock title="Selecionar Sistemas para Inspeção">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <p style={{
            fontFamily: tokens.fontMono,
            fontSize: '0.72rem',
            color: tokens.color.muted,
          }}>
            {selected.size === 0
              ? 'Selecione ao menos um sistema'
              : `${selected.size} de ${SECTIONS.length} sistemas selecionados`}
          </p>
          <button
            onClick={toggleAllSections}
            style={{ ...btnGhost, fontSize: '0.65rem', padding: '6px 14px' }}
          >
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 10,
        }}>
          {SECTIONS.map((sec) => {
            const active = selected.has(sec.id);
            return (
              <button
                key={sec.id}
                onClick={() => toggleSection(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 16px',
                  background: active ? tokens.color.accentDim : tokens.color.bgAlt,
                  border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
                  borderRadius: tokens.radius.lg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: tokens.transition.base,
                  boxShadow: active ? '0 1px 4px rgba(204,20,0,0.12)' : tokens.shadow.xs,
                }}
              >
                <span style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.borderMd}`,
                  borderRadius: 4,
                  background: active ? tokens.color.ferrari : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: tokens.transition.fast,
                }}>
                  {active && (
                    <svg width={9} height={9} viewBox="0 0 9 9" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" />
                    </svg>
                  )}
                </span>
                <span style={{
                  color: active ? tokens.color.ferrari : tokens.color.muted,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  transition: 'color 0.15s',
                }}>
                  <SectionIcon id={sec.id} size={15} />
                </span>
                <div>
                  <div style={{
                    fontFamily: tokens.fontMono,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: active ? tokens.color.text : tokens.color.textSecond,
                    transition: 'color 0.15s',
                  }}>
                    {sec.label}
                  </div>
                  <div style={{
                    fontFamily: tokens.fontMono,
                    fontSize: '0.58rem',
                    color: tokens.color.subtle,
                    marginTop: 2,
                  }}>
                    {sec.isDynamic ? 'itens variáveis' : `${sec.items.length} itens`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </FormBlock>

      <PanelFooter
        left={
          <span style={pfNote}>
            {selected.size > 0
              ? `${selected.size} sistema${selected.size > 1 ? 's' : ''} selecionado${selected.size > 1 ? 's' : ''}`
              : 'Nenhum sistema selecionado'}
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
            <button
              onClick={() => goStep(step + 1, step)}
              disabled={selected.size === 0}
              style={selected.size === 0 ? btnDisabled : btnAccent}
            >
              Ir para checklist
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
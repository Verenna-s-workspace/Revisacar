import { useOrdemServico } from '../../../../hooks/useOrdemServico';
import { Input } from '../../../../components/inputs/input';
import { Textarea } from '../../../../components/inputs/textarea';
import { tokens } from '../../../../constants';
import {
  FormBlock, Field, PanelFooter, SectionTitle,
  grid4, btnSolid, btnGhost, btnAccent, pfNote,
} from '../../../../components/ui';

interface StepProps {
  os: ReturnType<typeof useOrdemServico>;
  onExportPDF: () => void;
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

export function Step3({ os, onExportPDF }: StepProps) {
  const {
    veiculo, cliente, photos,
    tecnico, setTecnico,
    showErrors, errors,
    sigRef, sigHandlers, clearSig,
    savedAt, saveOrder, handleExport,
    goStep, step, stepDir,
  } = os;

  const hasErr = (k: string) => showErrors && !!errors[k];
  const nowDate = () => new Date().toISOString().split('T')[0];
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  const summaryRows: [string, string | number][] = [
    ['Veículo', [veiculo.placa, veiculo.modelo, veiculo.ano].filter(Boolean).join(' · ') || '—'],
    ['Cliente', cliente.nome || '—'],
    ['Fotos registradas', photos.length],
  ];

  return (
    <StepWrapper direction={stepDir}>
      <div style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: '26px 40px',
      }}>
        <SectionTitle>Resumo da OS</SectionTitle>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1,
          background: tokens.color.border,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          overflow: 'hidden',
        }}>
          {summaryRows.map(([k, v]) => (
            <div key={k} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '11px 16px',
              background: tokens.color.surface,
              fontSize: '0.85rem',
            }}>
              <span style={{ color: tokens.color.muted, fontFamily: tokens.fontMono, fontSize: '0.72rem' }}>
                {k}
              </span>
              <span style={{ fontWeight: 600, color: tokens.color.text, fontFamily: tokens.fontMono, fontSize: '0.8rem' }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <FormBlock title="Dados do Técnico">
        {showErrors && errors.tec_nome && (
          <div style={{
            background: tokens.color.critBg,
            border: `1px solid ${tokens.color.critBorder}`,
            borderLeft: `2.5px solid ${tokens.color.crit}`,
            padding: '10px 14px',
            marginBottom: 18,
            fontSize: '0.82rem',
            color: tokens.color.crit,
            borderRadius: tokens.radius.md,
            fontFamily: tokens.fontMono,
          }}>
            Preencha o nome do técnico para gerar o PDF.
          </div>
        )}
        <div style={grid4}>
          <Field label="Nome do técnico *" span={2}>
            <Input
              name="tec_nome" placeholder="Nome completo"
              value={tecnico.nome} onlyText
              error={hasErr('tec_nome') ? 'Campo obrigatório' : undefined}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, nome: v }))}
            />
          </Field>
          <Field label="Registro / CREA">
            <Input
              name="tec_registro" placeholder="000000"
              value={tecnico.registro}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, registro: v }))}
            />
          </Field>
          <Field label="Km saída">
            <Input
              name="tec_km_saida" onlyNumbers placeholder="97.550"
              value={tecnico.km_saida}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, km_saida: v }))}
            />
          </Field>
          <Field label="Data de saída">
            <Input
              name="tec_data_saida" type="date"
              value={tecnico.data_saida || nowDate()}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, data_saida: v }))}
            />
          </Field>
          <Field label="Hora de saída">
            <Input
              name="tec_hora_saida" type="time"
              value={tecnico.hora_saida || nowTime()}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, hora_saida: v }))}
            />
          </Field>
          <Field label="Parecer geral" span={4}>
            <Textarea
              name="tec_parecer_geral" value={tecnico.parecer_geral}
              placeholder="Descreva o estado geral do veículo e recomendações..."
              onChangeValue={(v) => setTecnico((p) => ({ ...p, parecer_geral: v }))}
            />
          </Field>
        </div>
      </FormBlock>

      <div style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: '26px 40px',
      }}>
        <SectionTitle>Assinatura do Técnico</SectionTitle>
        <canvas
          ref={sigRef}
          className="sig-canvas"
          style={{ display: 'block', width: '100%', height: 140 }}
          {...sigHandlers}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
          <span style={{ fontFamily: tokens.fontMono, fontSize: '0.6rem', color: tokens.color.subtle }}>
            Assine com o mouse ou o dedo
          </span>
          <button
            onClick={clearSig}
            style={{
              fontFamily: tokens.fontMono,
              fontSize: '0.6rem',
              color: tokens.color.bg,
              width: 70,
              height: 28,
              background: tokens.color.ferrari,
              border: 'none',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              transition: tokens.transition.fast,
            }}
          >
            Limpar
          </button>
        </div>
      </div>

      <PanelFooter
        left={
          <span style={pfNote}>
            {savedAt ? `Salvo às ${savedAt}` : 'Rascunho não salvo'}
          </span>
        }
        right={
          <>
            <button onClick={() => goStep(2, step)} style={btnGhost}>
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={saveOrder} style={btnSolid}>
              Enviar para o banco de dados
            </button>
            <button onClick={() => handleExport(onExportPDF)} style={btnAccent}>
              <svg width={11} height={11} viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M5.5 1v6.5M3 5l2.5 2.5L8 5M1 9.5h9" />
              </svg>
              Gerar PDF da OS
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}
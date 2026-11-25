import type { CSSProperties } from "react";
import { useOrdemServico } from "../../../../hooks/useOrdemServico";
import { Input } from "../../../../components/inputs/input";
import { Textarea } from "../../../../components/inputs/textarea";
import { Field } from "../../../../components/ui";
import { textoFaltam } from "../../../../utils/fotos_obrigatorias";
import { FILTRO } from "../../../../components/inputs/masks";
import {
  LIM, DATA_MIN, hojeISO,
  validarNome, validarRegistro, validarKm, validarData,
} from "../../../../utils/campos_checklist";
import "../../../../styles/closure-mobile.css";

/**
 * Etapa 3 (Encerramento) do checklist de entrada — layout MOBILE.
 *
 * Resumo da OS em card (no lugar da grade de 2 colunas que estourava no celular),
 * formulário em coluna única e rodapé fixo sem sobreposição: "Próxima etapa" em
 * destaque e as ações secundárias numa linha própria. O "Voltar" fica na barra
 * superior (AppTopBar), por isso não existe mais no rodapé.
 */
interface StepClosureMobileProps {
  os: ReturnType<typeof useOrdemServico>;
  onExportPDF: () => void;
  onNextChecklist?: () => void;
}

const nowTime = () => new Date().toTimeString().slice(0, 5);

export function StepClosureMobile({ os, onExportPDF, onNextChecklist }: StepClosureMobileProps) {
  const {
    osHeader, veiculo, cliente, photos, tecnico, setTecnico,
    showErrors, errors, sigRef, sigHandlers, clearSig,
    savedAt, saveOrder, handleExport, exigirTecnico, goStep, step, stepDir, fotosObrig,
  } = os;
  const { resumo: fotosResumo, liberado: fotosLiberadas, fonte: fotosFonte } = fotosObrig;
  const hasErr = (k: string) => showErrors && !!errors[k];

  const fotosConferidas = fotosFonte !== "indisponivel";
  const modeloAno = [veiculo.modelo, veiculo.ano].filter(Boolean).join(" • ");

  // Diagnóstico só com o técnico responsável preenchido e as fotos obrigatórias resolvidas.
  const podeAvancar = fotosLiberadas && !!tecnico.nome?.trim();
  const avancar = () => {
    if (!exigirTecnico()) {
      document.getElementsByName("tec_nome")[0]?.focus();
      return;
    }
    if (!fotosLiberadas) {
      goStep(2, step);
      return;
    }
    onNextChecklist?.();
  };

  // O wrapper externo contém o deslocamento lateral da animação de entrada
  // (overflow-x: clip não cria área de rolagem, então o rodapé sticky segue
  // ancorado na tela e a página não ganha rolagem horizontal).
  return (
    <div className="clm-root">
    <div
      className={stepDir === "forward" ? "step-enter" : "step-enter-left"}
      style={{ willChange: "transform, opacity" } as CSSProperties}
    >
      {!fotosLiberadas && (
        <div className="clm-alert" role="alert">
          <span>
            {fotosFonte === "ok"
              ? `${textoFaltam(fotosResumo.faltam.length)} da entrada. Tire as fotos (ou informe o motivo) para seguir ao diagnóstico.`
              : "As fotos obrigatórias da entrada ainda não foram conferidas."}
          </span>
          <button type="button" className="clm-alert__btn" onClick={() => goStep(2, step)}>
            Ir para as fotos
          </button>
        </div>
      )}

      {/* ── Resumo da OS ─────────────────────────────────────────────── */}
      <section className="clm-section" aria-labelledby="clm-resumo">
        <h2 className="clm-heading" id="clm-resumo">Resumo da OS</h2>
        <div className="clm-card">
          <div className="clm-card__grid">
            <div className="clm-card__cell">
              <span className="clm-label">Veículo</span>
              {veiculo.placa ? <span className="clm-plate">{veiculo.placa}</span> : <span className="clm-value">—</span>}
              {modeloAno && <span className="clm-sub">{modeloAno}</span>}
            </div>
            <div className="clm-card__cell">
              <span className="clm-label">Cliente</span>
              <span className="clm-client">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="clm-value">{cliente.nome || "—"}</span>
              </span>
            </div>
          </div>

          <div className="clm-card__photos">
            <div className="clm-card__photos-head">
              <span className="clm-label">Fotos registradas</span>
              {fotosConferidas && (
                <span className={`clm-badge ${fotosLiberadas ? "clm-badge--ok" : "clm-badge--warn"}`}>
                  {fotosLiberadas ? "Completo" : "Pendente"}
                </span>
              )}
            </div>
            <div className="clm-card__photos-body">
              <strong>
                {fotosConferidas ? `${fotosResumo.resolvidas} de ${fotosResumo.total} obrigatórias` : `${photos.length} fotos`}
              </strong>
              {fotosConferidas && <span className="clm-sub">{photos.length} adicionais</span>}
            </div>
          </div>
        </div>
      </section>

      {/* ── Dados do técnico ─────────────────────────────────────────── */}
      <section className="clm-section" aria-labelledby="clm-tecnico">
        <h2 className="clm-heading" id="clm-tecnico">Dados do Técnico</h2>

        {showErrors && errors.tec_nome && (
          <div className="clm-error" role="alert">Preencha o nome do técnico responsável para seguir ao diagnóstico ou gerar o PDF.</div>
        )}

        <div className="clm-form">
          <Field label="Nome do técnico *">
            <Input
              name="tec_nome"
              placeholder="Nome completo"
              value={tecnico.nome}
              type="nome" maxLength={LIM.nome} validate={validarNome}
              error={hasErr("tec_nome") ? errors.tec_nome : undefined}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, nome: v }))}
            />
          </Field>
          <Field label="Registro / CREA">
            <Input
              name="tec_registro"
              placeholder="000000"
              value={tecnico.registro}
              maxLength={LIM.registro} filter={FILTRO.registro} validate={validarRegistro}
              error={hasErr("tec_registro") ? errors.tec_registro : undefined}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, registro: v }))}
            />
          </Field>
          <Field label="Km saída">
            <Input
              name="tec_km_saida"
              type="km"
              placeholder="97.550"
              value={tecnico.km_saida}
              validate={validarKm}
              error={hasErr("tec_km") ? errors.tec_km : undefined}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, km_saida: v }))}
            />
          </Field>
          <Field label="Data de saída">
            <div className="clm-date">
              <Input
                name="tec_data_saida"
                type="date"
                value={tecnico.data_saida || hojeISO()}
                min={osHeader.os_date || DATA_MIN} max={hojeISO()} validate={validarData}
                error={hasErr("tec_data") ? errors.tec_data : undefined}
                onChangeValue={(v) => setTecnico((p) => ({ ...p, data_saida: v }))}
              />
              <span className="clm-date__icon" aria-hidden="true">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
            </div>
          </Field>
          <Field label="Hora de saída">
            <Input
              name="tec_hora_saida"
              type="time"
              value={tecnico.hora_saida || nowTime()}
              onChangeValue={(v) => setTecnico((p) => ({ ...p, hora_saida: v }))}
            />
          </Field>
          <Field label="Parecer geral">
            <Textarea
              name="tec_parecer_geral"
              value={tecnico.parecer_geral}
              maxLength={LIM.parecer}
              placeholder="Descreva o estado geral do veículo e recomendações..."
              onChangeValue={(v) => setTecnico((p) => ({ ...p, parecer_geral: v }))}
            />
          </Field>
        </div>
      </section>

      {/* ── Assinatura (necessária para o PDF) ───────────────────────── */}
      <section className="clm-section" aria-labelledby="clm-assinatura">
        <h2 className="clm-heading" id="clm-assinatura">Assinatura do Técnico</h2>
        <canvas ref={sigRef} className="sig-canvas clm-sig" {...sigHandlers} />
        <div className="clm-sig__bar">
          <span className="clm-sub">Assine com o dedo</span>
          <button type="button" className="clm-sig__clear" onClick={clearSig}>Limpar</button>
        </div>
      </section>

      {/* ── Rodapé fixo ──────────────────────────────────────────────── */}
      <div className="clm-footer" role="group" aria-label="Ações do encerramento">
        <p className="clm-footer__status" role="status">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
          {savedAt ? `Salvo às ${savedAt}` : "Rascunho não salvo"}
        </p>

        <button
          type="button"
          className={`clm-btn clm-btn--primary${podeAvancar ? "" : " is-blocked"}`}
          aria-disabled={!podeAvancar}
          onClick={avancar}
        >
          Próxima etapa
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

        <div className="clm-footer__row">
          <button type="button" className="clm-btn clm-btn--secondary" onClick={saveOrder}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9c2 0 3.5 1 3.5 3M4 7h16m-8 4v6m-3-3l3 3 3-3" />
            </svg>
            <span>Salvar</span>
          </button>
          <button type="button" className="clm-btn clm-btn--soft" onClick={() => handleExport(onExportPDF)}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            <span>Gerar PDF da OS</span>
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

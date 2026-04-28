import { CSSProperties } from "react";
import { useState } from "react";
import { Input } from "./inputs/input";
import { Textarea } from "./inputs/textarea";
import { Select } from "./inputs/select";
import {
  SECTIONS,
  COMBUSTIVEL_OPTIONS,
  NIVEL_COMBUSTIVEL_OPTIONS,
  tokens,
} from "../constants";

import {
  FormBlock,
  Field,
  PanelFooter,
  PhotoGrid,
  SectionTitle,
  SectionIcon,
  ValidationBanner,
  StatBadge,
  grid3,
  grid4,
  btnSolid,
  btnGhost,
  btnDisabled,
  btnAccent,
  pfNote,
} from "./ui";
import { ChecklistSection } from "./Checklist";
import type {
  OSHeader,
  Cliente,
  Veiculo,
  Tecnico,
  Photo,
  ChecklistStats,
  CritItem,
  ValidationErrors,
} from "../types";

// ── StepWrapper ───────────────────────────────────────────────────────────────

interface StepWrapperProps {
  children: React.ReactNode;
  direction?: "forward" | "back";
}

function StepWrapper({ children, direction = "forward" }: StepWrapperProps) {
  return (
    <div
      className={direction === "forward" ? "step-enter" : "step-enter-left"}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </div>
  );
}

// ── Step 1 — Identificação ────────────────────────────────────────────────────

interface Step1Props {
  osHeader: OSHeader;
  setOsHeader: React.Dispatch<React.SetStateAction<OSHeader>>;
  cliente: Cliente;
  setCliente: React.Dispatch<React.SetStateAction<Cliente>>;
  veiculo: Veiculo;
  setVeiculo: React.Dispatch<React.SetStateAction<Veiculo>>;
  photos: Photo[];
  handlePhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (i: number) => void;
  setLightbox: (src: string | null) => void;
  savedAt: string | null;
  showErrors: boolean;
  errors: ValidationErrors;
  onSave: () => void;
  onNext: () => void;
  stepDir: "forward" | "back";
}

export function Step1({
  osHeader,
  setOsHeader,
  cliente,
  setCliente,
  veiculo,
  setVeiculo,
  photos,
  handlePhotos,
  removePhoto,
  setLightbox,
  savedAt,
  showErrors,
  errors,
  onSave,
  onNext,
  stepDir,
}: Step1Props) {
  const hasErr = (k: string) => showErrors && !!errors[k];

  function formatDoc(value: string) {
    const raw = value.replace(/\D/g, "");
    if (raw.length <= 11) {
      return raw
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return raw
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
  }

  function validatePlaca(placa: string) {
    if (!placa || placa.trim() === "") return undefined;
    if (/^[A-Za-z]{3}\d[A-Za-z]\d{2}$/.test(placa)) return undefined;
    if (/^[A-Za-z]{3}-?\d{4}$/.test(placa)) return undefined;
    return "Placa inválida";
  }

  return (
    <StepWrapper direction={stepDir}>
      <ValidationBanner show={showErrors && Object.keys(errors).length > 0}>
        Preencha os campos obrigatórios antes de continuar.
      </ValidationBanner>

      <FormBlock title="Ordem de Serviço">
        <div style={grid4}>
          <Field label="Nº da OS *">
            <Input
              name="os_num"
              onlyNumbers
              placeholder="000001"
              value={osHeader.os_num}
              error={hasErr("os_num") ? "Campo obrigatório" : undefined}
              onChangeValue={(value) =>
                setOsHeader((p) => ({ ...p, os_num: value }))
              }
            />
          </Field>
          <Field label="Data de entrada *">
            <Input
              name="os_date"
              type="date"
              value={osHeader.os_date}
              error={hasErr("os_date") ? "Campo obrigatório" : undefined}
              onChangeValue={(value) =>
                setOsHeader((p) => ({ ...p, os_date: value }))
              }
            />
          </Field>
          <Field label="Hora de entrada *">
            <Input
              name="os_time"
              type="time"
              value={osHeader.os_time}
              error={hasErr("os_time") ? "Campo obrigatório" : undefined}
              onChangeValue={(value) =>
                setOsHeader((p) => ({ ...p, os_time: value }))
              }
            />
          </Field>
          <Field label="Km atual" hint="ex: 87.450">
            <Input
              name="os_km"
              onlyNumbers
              placeholder="87.450"
              value={osHeader.os_km}
              onChangeValue={(value) =>
                setOsHeader((p) => ({ ...p, os_km: value }))
              }
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Dados do Cliente">
        <div style={grid3}>
          <Field label="Nome completo *" span={2}>
            <Input
              name="cliente_nome"
              placeholder="Ex: João da Silva"
              onlyText
              error={hasErr("cli_nome") ? "Campo obrigatório" : undefined}
              value={cliente.nome}
              onChangeValue={(value) =>
                setCliente((p) => ({ ...p, nome: value }))
              }
            />
          </Field>
          <Field label="CPF / CNPJ">
            <Input
              name="cliente_doc"
              placeholder="000.000.000-00"
              value={formatDoc(cliente.doc)}
              maxLength={18}
              onChangeValue={(value) => {
                const raw = value.replace(/\D/g, "");
                setCliente((p) => ({ ...p, doc: raw }));
              }}
            />
          </Field>
          <Field label="Telefone *">
            <Input
              name="cliente_tel"
              placeholder="(00) 00000-0000"
              mask="(99) 99999-9999"
              value={cliente.tel}
              error={hasErr("cli_tel") ? "Campo obrigatório" : undefined}
              onChangeValue={(value) =>
                setCliente((p) => ({ ...p, tel: value }))
              }
            />
          </Field>
          <Field label="E-mail" span={2}>
            <Input
              name="cliente_email"
              placeholder="cliente@email.com"
              value={cliente.email}
              onChangeValue={(value) =>
                setCliente((p) => ({ ...p, email: value }))
              }
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Dados do Veículo">
        <div style={grid4}>
          <Field label="Placa *">
            <Input
              name="veiculo_placa"
              placeholder="ABC1C34 / ABC-1234"
              value={veiculo.placa}
              maxLength={8}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, placa: value }))
              }
              error={validatePlaca(veiculo.placa)}
            />
          </Field>
          <Field label="Modelo *" span={2}>
            <Input
              name="veiculo_modelo"
              placeholder="ex: Toyota Corolla"
              value={veiculo.modelo}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, modelo: value }))
              }
              error={hasErr("vei_modelo") ? "Campo obrigatório" : undefined}
            />
          </Field>
          <Field label="Ano">
            <Input
              name="veiculo_ano"
              placeholder="2014"
              value={veiculo.ano}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, ano: value }))
              }
              maxLength={4}
            />
          </Field>
          <Field label="Cor">
            <Input
              name="veiculo_cor"
              placeholder="Prata"
              value={veiculo.cor}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, cor: value }))
              }
            />
          </Field>
          <Field label="Combustível">
            <Select
              name="combustivel"
              value={veiculo.combustivel}
              options={COMBUSTIVEL_OPTIONS}
              placeholder="Selecione..."
              error={errors.combustivel}
              onChangeValue={(val) =>
                setVeiculo((p) => ({ ...p, combustivel: val }))
              }
            />
          </Field>
          
          <Field label="Nível combustível">
            <Select
              name="nivel_combustivel"
              value={veiculo.nivel_combustivel}
              options={NIVEL_COMBUSTIVEL_OPTIONS}
              placeholder="Selecione..."
              error={errors.nivel_combustivel}
              onChangeValue={(val) =>
                setVeiculo((p) => ({ ...p, nivel_combustivel: val }))
              }
            />
          </Field>
          <Field label="Chassi" span={2} hint="17 caracteres">
            <Input
              name="veiculo_chassi"
              placeholder="ex: 9BWZZZ377VT004251"
              value={veiculo.chassi}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, chassi: value }))
              }
              maxLength={17}
            />
          </Field>
          <Field label="Observações de entrada" span={4}>
            <Textarea
              name="veiculo_obs_entrada"
              value={veiculo.obs_entrada}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, obs_entrada: value }))
              }
              placeholder="Riscos, amassados, itens faltantes..."
            />
          </Field>
          <Field label="Relato do cliente" span={4}>
            <Textarea
              name="veiculo_obs_cliente"
              value={veiculo.obs_cliente}
              onChangeValue={(value) =>
                setVeiculo((p) => ({ ...p, obs_cliente: value }))
              }
              placeholder="Descreva o que o cliente relatou sobre o problema do veículo..."
            />
          </Field>
        </div>
      </FormBlock>

      <FormBlock title="Fotos de Entrada">
        <PhotoGrid
          photos={photos}
          handlePhotos={handlePhotos}
          onRemove={removePhoto}
          onPreview={(src) => setLightbox(src)}
        />
      </FormBlock>

      <PanelFooter
        left={
          <span style={pfNote}>
            {savedAt ? `Salvo às ${savedAt}` : "Rascunho não salvo"}
          </span>
        }
        right={
          <>
            <button onClick={onSave} style={btnGhost}>
              Salvar rascunho
            </button>
            <button onClick={onNext} style={btnAccent}>
              Próximo
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}

// ── Step 2 — Serviços ─────────────────────────────────────────────────────────

interface Step2Props {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onBack: () => void;
  onNext: () => void;
  stepDir: "forward" | "back";
}

export function Step2({
  selected,
  onToggle,
  onToggleAll,
  onBack,
  onNext,
  stepDir,
}: Step2Props) {
  const allSelected = selected.size === SECTIONS.length;

  return (
    <StepWrapper direction={stepDir}>
      <FormBlock title="Selecionar Sistemas para Inspeção">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontFamily: tokens.fontMono,
              fontSize: "0.72rem",
              color: tokens.color.muted,
            }}
          >
            {selected.size === 0
              ? "Selecione ao menos um sistema"
              : `${selected.size} de ${SECTIONS.length} sistemas selecionados`}
          </p>
          <button
            onClick={onToggleAll}
            style={{ ...btnGhost, fontSize: "0.65rem", padding: "6px 14px" }}
          >
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {SECTIONS.map((sec) => {
            const active = selected.has(sec.id);
            return (
              <button
                key={sec.id}
                onClick={() => onToggle(sec.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  background: active
                    ? tokens.color.accentDim
                    : tokens.color.bgAlt,
                  border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.border}`,
                  borderRadius: tokens.radius.lg,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: tokens.transition.base,
                  boxShadow: active
                    ? "0 1px 4px rgba(204,20,0,0.12)"
                    : tokens.shadow.xs,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    border: `1.5px solid ${active ? tokens.color.ferrari : tokens.color.borderMd}`,
                    borderRadius: 4,
                    background: active ? tokens.color.ferrari : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: tokens.transition.fast,
                  }}
                >
                  {active && (
                    <svg
                      width={9}
                      height={9}
                      viewBox="0 0 9 9"
                      fill="none"
                      stroke="#fff"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="1.5,4.5 3.5,6.5 7.5,2.5" />
                    </svg>
                  )}
                </span>
                <span
                  style={{
                    color: active ? tokens.color.ferrari : tokens.color.muted,
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                    transition: "color 0.15s",
                  }}
                >
                  <SectionIcon id={sec.id} size={15} />
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: tokens.fontMono,
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: active
                        ? tokens.color.text
                        : tokens.color.textSecond,
                      transition: "color 0.15s",
                    }}
                  >
                    {sec.label}
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.fontMono,
                      fontSize: "0.58rem",
                      color: tokens.color.subtle,
                      marginTop: 2,
                    }}
                  >
                    {sec.isDynamic
                      ? "itens variáveis"
                      : `${sec.items.length} itens`}
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
              ? `${selected.size} sistema${selected.size > 1 ? "s" : ""} selecionado${selected.size > 1 ? "s" : ""}`
              : "Nenhum sistema selecionado"}
          </span>
        }
        right={
          <>
            <button onClick={onBack} style={btnGhost}>
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button
              onClick={onNext}
              disabled={selected.size === 0}
              style={selected.size === 0 ? btnDisabled : btnAccent}
            >
              Ir para checklist
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}

// ── Step 3 — Checklist ────────────────────────────────────────────────────────

interface Step3Props {
  selected: Set<string>;
  checklist: Record<string, { status: string | null; obs: string }>;
  stats: ChecklistStats;
  onSetStatus: (key: string, val: string) => void;
  onSetObs: (key: string, val: string) => void;
  // Itens dinâmicos — vêm do hook, não são mais estado local
  itensAdicionais: string[];
  onAddItem: (name: string) => void;
  onRemoveItem: (index: number) => void;
  savedAt: string | null;
  onSave: () => void;
  onBack: () => void;
  onNext: () => void;
  stepDir: "forward" | "back";
}

export function Step3({
  selected,
  checklist,
  stats,
  onSetStatus,
  onSetObs,
  itensAdicionais,
  onAddItem,
  onRemoveItem,
  savedAt,
  onSave,
  onBack,
  onNext,
  stepDir,
}: Step3Props) {
  const { done, total, ok, warn, crit } = stats;
  const progress = total ? (done / total) * 100 : 0;

  return (
    <StepWrapper direction={stepDir}>
      {/* Progress panel */}
      <div
        style={{
          background: tokens.color.surface,
          borderBottom: `1px solid ${tokens.color.border}`,
          padding: "18px 40px",
          display: "flex",
          alignItems: "center",
          gap: 40,
          boxShadow: tokens.shadow.xs,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 7,
            }}
          >
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: "0.62rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: tokens.color.subtle,
              }}
            >
              Progresso da inspeção
            </span>
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: "0.62rem",
                color: tokens.color.muted,
              }}
            >
              {done} / {total} itens
            </span>
          </div>
          <div
            style={{
              height: 3,
              background: tokens.color.border,
              overflow: "hidden",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                height: "100%",
                background:
                  crit > 0
                    ? `linear-gradient(90deg, ${tokens.color.crit}, ${tokens.color.ferrariDark})`
                    : `linear-gradient(90deg, ${tokens.color.ok}, #15803d)`,
                width: `${progress}%`,
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                borderRadius: 2,
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          <StatBadge value={ok} label="OK" color={tokens.color.ok} />
          <StatBadge value={warn} label="Atenção" color={tokens.color.warn} />
          <StatBadge value={crit} label="Crítico" color={tokens.color.crit} />
        </div>
      </div>

      <div style={{ padding: "28px 40px 0", maxWidth: 1100, margin: "0 auto" }}>
        {SECTIONS.filter((s) => selected.has(s.id)).map((sec) => (
          <ChecklistSection
            key={sec.id}
            sec={sec}
            checklist={checklist}
            onSetStatus={onSetStatus}
            onSetObs={onSetObs}
            itensAdicionais={itensAdicionais}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>

      <PanelFooter
        left={
          <span style={pfNote}>
            {savedAt ? `Salvo às ${savedAt}` : "Rascunho não salvo"}
          </span>
        }
        right={
          <>
            <button onClick={onBack} style={btnGhost}>
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={onSave} style={btnSolid}>
              Salvar
            </button>
            <button onClick={onNext} style={btnAccent}>
              Fotos
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}

// ── Step 4 — Fotos ────────────────────────────────────────────────────────────

interface Step4Props {
  photos: Photo[];
  handlePhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (i: number) => void;
  setLightbox: (src: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  stepDir: "forward" | "back";
}

export function Step4({
  photos,
  handlePhotos,
  removePhoto,
  setLightbox,
  onBack,
  onNext,
  stepDir,
}: Step4Props) {
  return (
    <StepWrapper direction={stepDir}>
      <FormBlock title="Registro Fotográfico da Inspeção">
        <p
          style={{
            fontFamily: tokens.fontMono,
            fontSize: "0.65rem",
            color: tokens.color.muted,
            marginBottom: 18,
          }}
        >
          Fotografe pontos de atenção, defeitos e condições do veículo. As fotos
          serão incluídas no relatório PDF.
        </p>
        <PhotoGrid
          photos={photos}
          handlePhotos={handlePhotos}
          onRemove={removePhoto}
          onPreview={(src) => setLightbox(src)}
        />
      </FormBlock>

      <PanelFooter
        left={null}
        right={
          <>
            <button onClick={onBack} style={btnGhost}>
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={onNext} style={btnAccent}>
              Encerramento
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />
    </StepWrapper>
  );
}

// ── Step 5 — Encerramento ─────────────────────────────────────────────────────

interface Step5Props {
  veiculo: Veiculo;
  cliente: Cliente;
  selected: Set<string>;
  stats: ChecklistStats;
  critItems: CritItem[];
  photos: Photo[];
  tecnico: Tecnico;
  setTecnico: React.Dispatch<React.SetStateAction<Tecnico>>;
  showErrors: boolean;
  errors: ValidationErrors;
  sigRef: React.RefObject<HTMLCanvasElement>;
  sigHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
  };
  onClearSig: () => void;
  savedAt: string | null;
  onSave: () => void;
  onBack: () => void;
  onExport: () => void;
  stepDir: "forward" | "back";
}

export function Step5({
  veiculo,
  cliente,
  selected,
  stats,
  critItems,
  photos,
  tecnico,
  setTecnico,
  showErrors,
  errors,
  sigRef,
  sigHandlers,
  onClearSig,
  savedAt,
  onSave,
  onBack,
  onExport,
  stepDir,
}: Step5Props) {
  const hasErr = (k: string) => showErrors && !!errors[k];
  const { done, total, ok, warn, crit, na } = stats;
  const selectedSections = SECTIONS.filter((s) => selected.has(s.id));
  const nowDate = () => new Date().toISOString().split("T")[0];
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  const summaryRows: [string, string | number, string?][] = [
    [
      "Veículo",
      [veiculo.placa, veiculo.modelo, veiculo.ano]
        .filter(Boolean)
        .join(" · ") || "—",
      undefined,
    ],
    ["Cliente", cliente.nome || "—", undefined],
    [
      "Sistemas inspecionados",
      selectedSections.map((s) => s.label).join(", ") || "—",
      undefined,
    ],
    ["Itens avaliados", `${done} / ${total}`, undefined],
    ["OK", ok, tokens.color.ok],
    ["Atenção", warn, tokens.color.warn],
    ["Crítico", crit, tokens.color.crit],
    ["N/A", na, undefined],
    ["Fotos registradas", photos.length, undefined],
  ];

  return (
    <StepWrapper direction={stepDir}>
      {/* Resumo */}
      <div
        style={{
          background: tokens.color.surface,
          borderBottom: `1px solid ${tokens.color.border}`,
          padding: "26px 40px",
        }}
      >
        <SectionTitle>Resumo da OS</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: tokens.color.border,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.md,
            overflow: "hidden",
          }}
        >
          {summaryRows.map(([k, v, c]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "11px 16px",
                background: tokens.color.surface,
                fontSize: "0.85rem",
              }}
            >
              <span
                style={{
                  color: tokens.color.muted,
                  fontFamily: tokens.fontMono,
                  fontSize: "0.72rem",
                }}
              >
                {k}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: c || tokens.color.text,
                  fontFamily: tokens.fontMono,
                  fontSize: "0.8rem",
                }}
              >
                {String(v)}
              </span>
            </div>
          ))}
        </div>

        {critItems.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SectionTitle>Itens Críticos</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {critItems.map((ci, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "11px 16px",
                    background: tokens.color.critBg,
                    border: `1px solid ${tokens.color.critBorder}`,
                    borderRadius: tokens.radius.md,
                    borderLeft: `2.5px solid ${tokens.color.crit}`,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: tokens.color.crit,
                      marginTop: 6,
                      flexShrink: 0,
                      display: "block",
                    }}
                  />
                  <div style={{ fontSize: "0.85rem" }}>
                    <span
                      style={{
                        fontFamily: tokens.fontMono,
                        fontSize: "0.58rem",
                        color: tokens.color.crit,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      {ci.sec}
                    </span>
                    <span style={{ color: tokens.color.text }}>{ci.name}</span>
                    {ci.obs && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: tokens.color.muted,
                          marginTop: 3,
                        }}
                      >
                        {ci.obs}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Técnico */}
      <FormBlock title="Dados do Técnico">
        {showErrors && errors.tec_nome && (
          <div
            style={{
              background: tokens.color.critBg,
              border: `1px solid ${tokens.color.critBorder}`,
              borderLeft: `2.5px solid ${tokens.color.crit}`,
              padding: "10px 14px",
              marginBottom: 18,
              fontSize: "0.82rem",
              color: tokens.color.crit,
              borderRadius: tokens.radius.md,
              fontFamily: tokens.fontMono,
            }}
          >
            Preencha o nome do técnico para gerar o PDF.
          </div>
        )}
        <div style={grid4}>
          <Field label="Nome do técnico *" span={2}>
            <Input
              name="tec_nome"
              placeholder="Nome completo"
              value={tecnico.nome}
              onlyText
              onChangeValue={(value) =>
                setTecnico((p) => ({ ...p, nome: value }))
              }
              error={hasErr("tec_nome") ? "Campo obrigatório" : undefined}
            />
          </Field>
          <Field label="Registro / CREA">
            <Input
              name="tec_registro"
              placeholder="000000"
              value={tecnico.registro}
              onChangeValue={(value) =>
                setTecnico((p) => ({ ...p, registro: value }))
              }
            />
          </Field>
          <Field label="Km saída">
            <Input
              name="tec_km_saida"
              onlyNumbers
              placeholder="97.550"
              value={tecnico.km_saida}
              onChangeValue={(value) =>
                setTecnico((p) => ({ ...p, km_saida: value }))
              }
            />
          </Field>
          <Field label="Data de saída">
            <Input
              name="tec_data_saida"
              type="date"
              value={tecnico.data_saida || nowDate()}
              onChangeValue={(value) =>
                setTecnico((p) => ({ ...p, data_saida: value }))
              }
            />
          </Field>
          <Field label="Hora de saída">
            <Input
              name="tec_hora_saida"
              type="time"
              value={tecnico.hora_saida || nowTime()}
              onChangeValue={(value) =>
                setTecnico((p) => ({ ...p, hora_saida: value }))
              }
            />
          </Field>
          <Field label="Parecer geral" span={4}>
            <Textarea
              name="tec_parecer_geral"
              value={tecnico.parecer_geral}
              onChangeValue={(value) =>
                setTecnico((p) => ({ ...p, parecer_geral: value }))
              }
              placeholder="Descreva o estado geral do veículo e recomendações..."
            />
          </Field>
        </div>
      </FormBlock>

      {/* Assinatura */}
      <div
        style={{
          background: tokens.color.surface,
          borderBottom: `1px solid ${tokens.color.border}`,
          padding: "26px 40px",
        }}
      >
        <SectionTitle>Assinatura do Técnico</SectionTitle>
        <canvas
          ref={sigRef}
          className="sig-canvas"
          style={{ display: "block", width: "100%", height: 140 }}
          {...sigHandlers}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 9,
          }}
        >
          <span
            style={{
              fontFamily: tokens.fontMono,
              fontSize: "0.6rem",
              color: tokens.color.subtle,
            }}
          >
            Assine com o mouse ou o dedo
          </span>
          <button
            onClick={onClearSig}
            style={{
              fontFamily: tokens.fontMono,
              fontSize: "0.6rem",
              color: tokens.color.subtle,
              background: "none",
              border: "none",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              textDecoration: "underline",
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
            {savedAt ? `Salvo às ${savedAt}` : "Rascunho não salvo"}
          </span>
        }
        right={
          <>
            <button onClick={onBack} style={btnGhost}>
              <svg
                width={10}
                height={10}
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={onSave} style={btnSolid}>
              enviar para o banco de dados
            </button>
            <button onClick={onExport} style={btnAccent}>
              <svg
                width={11}
                height={11}
                viewBox="0 0 11 11"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              >
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

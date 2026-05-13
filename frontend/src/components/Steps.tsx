import { CSSProperties } from "react";
import { useState } from "react";
import { Input } from "./inputs/input";
import { Textarea } from "./inputs/textarea";
import { Select } from "./inputs/select";
import { CameraCapture } from './Camera/CameraCapture';
import {
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
  grid3,
  grid4,
  btnSolid,
  btnGhost,
  btnAccent,
  pfNote,
} from "./ui";

import type {
  OSHeader,
  Cliente,
  Veiculo,
  Tecnico,
  Photo,
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
              uppercase
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
              uppercase
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

// ── Step 2 — Fotos ────────────────────────────────────────────────────────────

interface Step2Props {
  photos: Photo[];
  handlePhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (i: number) => void;
  setLightbox: (src: string | null) => void;
  onAddPhoto: (photo: Photo) => void;
  onBack: () => void;
  onNext: () => void;
  stepDir: 'forward' | 'back';
}

export function Step2({
  photos,
  handlePhotos,
  removePhoto,
  setLightbox,
  onAddPhoto,
  onBack,
  onNext,
  stepDir,
}: Step2Props) {
  const [cameraOpen, setCameraOpen] = useState(false);

  return (
    <StepWrapper direction={stepDir}>
      <FormBlock title="Registro Fotográfico da Inspeção">
        <p style={{
          fontFamily: tokens.fontMono,
          fontSize: '0.65rem',
          color: tokens.color.muted,
          marginBottom: 18,
        }}>
          Fotografe pontos de atenção, defeitos e condições do veículo. As fotos
          serão incluídas no relatório PDF.
        </p>

        <button
          onClick={() => setCameraOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginBottom: 18,
            padding: '10px 18px',
            background: tokens.color.accentDim,
            border: `1.5px solid ${tokens.color.ferrari}`,
            borderRadius: tokens.radius.lg,
            color: tokens.color.ferrari,
            fontFamily: tokens.fontMono,
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(204,20,0,0.10)',
            transition: tokens.transition.base,
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Tirar foto com a câmera
        </button>

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
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={onNext} style={btnAccent}>
              Encerramento
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5h6M5.5 2l3 3-3 3" />
              </svg>
            </button>
          </>
        }
      />

      {cameraOpen && (
        <CameraCapture
          onCapture={(photo) => onAddPhoto(photo)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </StepWrapper>
  );
}

// ── Step 3 — Encerramento ─────────────────────────────────────────────────────

interface Step3Props {
  veiculo: Veiculo;
  cliente: Cliente;
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

export function Step3({
  veiculo,
  cliente,
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
}: Step3Props) {
  const hasErr = (k: string) => showErrors && !!errors[k];
  const nowDate = () => new Date().toISOString().split("T")[0];
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  const summaryRows: [string, string | number][] = [
    ["Veículo", [veiculo.placa, veiculo.modelo, veiculo.ano].filter(Boolean).join(" · ") || "—"],
    ["Cliente", cliente.nome || "—"],
    ["Fotos registradas", photos.length],
  ];

  return (
    <StepWrapper direction={stepDir}>
      <div style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: "26px 40px",
      }}>
        <SectionTitle>Resumo da OS</SectionTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: tokens.color.border,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.md,
          overflow: "hidden",
        }}>
          {summaryRows.map(([k, v]) => (
            <div key={k} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "11px 16px",
              background: tokens.color.surface,
              fontSize: "0.85rem",
            }}>
              <span style={{ color: tokens.color.muted, fontFamily: tokens.fontMono, fontSize: "0.72rem" }}>
                {k}
              </span>
              <span style={{ fontWeight: 600, color: tokens.color.text, fontFamily: tokens.fontMono, fontSize: "0.8rem" }}>
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
            padding: "10px 14px",
            marginBottom: 18,
            fontSize: "0.82rem",
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
              name="tec_nome"
              placeholder="Nome completo"
              value={tecnico.nome}
              onlyText
              onChangeValue={(value) => setTecnico((p) => ({ ...p, nome: value }))}
              error={hasErr("tec_nome") ? "Campo obrigatório" : undefined}
            />
          </Field>
          <Field label="Registro / CREA">
            <Input
              name="tec_registro"
              placeholder="000000"
              value={tecnico.registro}
              onChangeValue={(value) => setTecnico((p) => ({ ...p, registro: value }))}
            />
          </Field>
          <Field label="Km saída">
            <Input
              name="tec_km_saida"
              onlyNumbers
              placeholder="97.550"
              value={tecnico.km_saida}
              onChangeValue={(value) => setTecnico((p) => ({ ...p, km_saida: value }))}
            />
          </Field>
          <Field label="Data de saída">
            <Input
              name="tec_data_saida"
              type="date"
              value={tecnico.data_saida || nowDate()}
              onChangeValue={(value) => setTecnico((p) => ({ ...p, data_saida: value }))}
            />
          </Field>
          <Field label="Hora de saída">
            <Input
              name="tec_hora_saida"
              type="time"
              value={tecnico.hora_saida || nowTime()}
              onChangeValue={(value) => setTecnico((p) => ({ ...p, hora_saida: value }))}
            />
          </Field>
          <Field label="Parecer geral" span={4}>
            <Textarea
              name="tec_parecer_geral"
              value={tecnico.parecer_geral}
              onChangeValue={(value) => setTecnico((p) => ({ ...p, parecer_geral: value }))}
              placeholder="Descreva o estado geral do veículo e recomendações..."
            />
          </Field>
        </div>
      </FormBlock>

      <div style={{
        background: tokens.color.surface,
        borderBottom: `1px solid ${tokens.color.border}`,
        padding: "26px 40px",
        
      }}>
        <SectionTitle>Assinatura do Técnico</SectionTitle>
        <canvas
          ref={sigRef}
          className="sig-canvas"
          style={{ display: "block", width: "100%", height: 140 }}
          {...sigHandlers}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, }}>
          <span style={{ fontFamily: tokens.fontMono, fontSize: "0.6rem", color: tokens.color.subtle }}>
            Assine com o mouse ou o dedo
          </span>
          <button
            onClick={onClearSig}
            style={{
              fontFamily: tokens.fontMono,
              fontSize: "0.6rem",
              color: tokens.color.bg,
              width: 70,
              height: 28,
              background: tokens.color.ferrari,
              border: "none",
              borderRadius: tokens.radius.md,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
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
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H2M4.5 2l-3 3 3 3" />
              </svg>
              Voltar
            </button>
            <button onClick={onSave} style={btnSolid}>
              Enviar para o banco de dados
            </button>
            <button onClick={onExport} style={btnAccent}>
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
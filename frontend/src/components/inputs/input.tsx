import { useState } from "react";
import InputMask from "react-input-mask";
import "./input.css";
import {
  onlyDigits,
  formatCpfCnpj,
  isValidCpfCnpj,
  formatCEP,
  formatPhoneBR,
  formatPlaca,
  formatCurrencyBRL,
  parseCurrencyInput,
  isValidEmail,
} from "./masks";

/**
 * Tipos semânticos suportados, além de qualquer `type` HTML nativo (text,
 * number, date, time, url, tel...) que passa direto pro <input>. Formatação,
 * máscara e validação de formato de cada tipo especial ficam centralizadas
 * aqui — nenhuma página deve reimplementar isso (ver masks.ts).
 *
 * Pra adicionar um tipo novo: (1) escreva o formatador em masks.ts,
 * (2) registre-o no handleChange e no displayValue abaixo, (3) se precisar
 * de inputMode/autoComplete/type nativo específico, adicione nos mapas
 * NATIVE_TYPE/INPUT_MODE/AUTOCOMPLETE. Não crie um tipo novo pra uma tela só
 * — veja se `mask` (escape-hatch genérico) já resolve.
 */
export type InputType =
  | "text" | "number" | "email" | "password" | "search" | "date" | "time"
  | "currency" | "phone" | "cpf_cnpj" | "cep" | "placa" | "digits"
  | (string & {});

type InputProps = {
  name: string;
  type?: InputType;
  value: string;
  error?: string;
  onlyNumbers?: boolean;
  onlyText?: boolean;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
  maxLength?: number;
  mask?: string;
  uppercase?: boolean;
  /** Rótulo do campo. Opcional — se a página já usa <Field label="..."> por
   * fora, não passe aqui pra não duplicar. */
  label?: string;
  /** Texto de apoio abaixo do campo, some quando há erro. */
  hint?: string;
  disabled?: boolean;
  /** Implica disabled visualmente e mostra um spinner. */
  loading?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
  /** Sobrescreve o id (por padrão usa `name`). Útil quando o mesmo `name` se
   * repete na tela (ex.: linhas de uma lista). */
  id?: string;
  /** Escape-hatch só pra ajuste visual pontual (ex.: letter-spacing de um
   * PIN). Nunca deve carregar lógica de formatação — isso é papel do `type`. */
  style?: React.CSSProperties;
  /** Sugestões de autocomplete nativo (HTML5 <datalist>) — o navegador
   * mostra as opções conforme digita, mas o campo aceita qualquer valor
   * livre também (não é um <select> fechado). */
  datalistOptions?: string[];
  /** Passthrough nativo — usado por type="date"/"number" para limitar intervalo. */
  min?: string | number;
  max?: string | number;
};

const NATIVE_TYPE: Partial<Record<string, string>> = {
  currency: "text",
  phone: "tel",
  cpf_cnpj: "text",
  cep: "text",
  placa: "text",
  digits: "text",
  search: "search",
};

const INPUT_MODE: Partial<Record<string, "text" | "numeric" | "decimal" | "tel" | "email" | "search" | "none" | "url">> = {
  currency: "decimal",
  phone: "tel",
  cpf_cnpj: "numeric",
  cep: "numeric",
  digits: "numeric",
  number: "numeric",
  email: "email",
  search: "search",
};

const AUTOCOMPLETE: Partial<Record<string, string>> = {
  phone: "tel",
  cep: "postal-code",
  email: "email",
  password: "current-password",
};

const SPECIAL_TYPES = new Set(["currency", "phone", "cpf_cnpj", "cep", "placa", "digits"]);

function Spinner() {
  return (
    <svg className="inp-spinner" width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity={0.2} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5.1" /><line x1="14" y1="14" x2="10.6" y2="10.6" />
    </svg>
  );
}
function ClearGlyph() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}
function EyeGlyph({ off }: { off?: boolean }) {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8S4 3.3 8 3.3 14.5 8 14.5 8 12 12.7 8 12.7 1.5 8 1.5 8Z" opacity={off ? 0.35 : 1} />
      <circle cx="8" cy="8" r="2.1" opacity={off ? 0.35 : 1} />
      {off && <line x1="2" y1="2" x2="14" y2="14" />}
    </svg>
  );
}

export function Input({
  name,
  type = "text",
  value,
  error,
  onlyNumbers,
  onlyText,
  placeholder,
  onChangeValue,
  maxLength,
  mask,
  uppercase,
  label,
  hint,
  disabled,
  loading,
  required,
  autoFocus,
  autoComplete,
  onBlur,
  id,
  style,
  datalistOptions,
  min,
  max,
}: InputProps) {
  const [pwVisible, setPwVisible] = useState(false);
  const [blurred, setBlurred] = useState(false);

  const fieldId = id ?? name;
  const isDisabled = !!disabled || !!loading;
  const isSpecial = SPECIAL_TYPES.has(type);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    if (type === "currency") { onChangeValue?.(parseCurrencyInput(raw)); return; }
    if (type === "phone")    { onChangeValue?.(onlyDigits(raw).slice(0, 11)); return; }
    if (type === "cpf_cnpj") { onChangeValue?.(onlyDigits(raw).slice(0, 14)); return; }
    if (type === "cep")      { onChangeValue?.(onlyDigits(raw).slice(0, 8)); return; }
    if (type === "placa")    { onChangeValue?.(formatPlaca(raw)); return; }
    if (type === "digits")   { onChangeValue?.(onlyDigits(raw).slice(0, maxLength)); return; }

    let v = raw;
    if (onlyNumbers) v = v.replace(/[^0-9.-]/g, "");
    if (onlyText) v = v.replace(/[^\p{L}\s]/gu, "");
    if (uppercase) v = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (mask) { onChangeValue?.(raw); return; }
    onChangeValue?.(v);
  }

  function handleBlur() {
    setBlurred(true);
    onBlur?.();
  }

  const displayValue = (() => {
    switch (type) {
      case "currency": return formatCurrencyBRL(value);
      case "phone":    return formatPhoneBR(value);
      case "cpf_cnpj": return formatCpfCnpj(value);
      case "cep":      return formatCEP(value);
      default:         return value;
    }
  })();

  // Validação de formato centralizada — só entra em ação quando a página não
  // já forneceu um `error` próprio (ex.: "campo obrigatório"), que sempre
  // tem prioridade.
  const internalError = (() => {
    if (error) return undefined;
    if (type === "cpf_cnpj" && value.length >= 11 && !isValidCpfCnpj(value)) return "CPF/CNPJ inválido";
    if (type === "email" && blurred && value && !isValidEmail(value)) return "E-mail inválido";
    return undefined;
  })();
  const effectiveError = error ?? internalError;

  const errorId = effectiveError ? `${fieldId}-erro` : undefined;
  const hintId = hint ? `${fieldId}-dica` : undefined;

  const nativeType = type === "password" ? (pwVisible ? "text" : "password") : (NATIVE_TYPE[type] ?? type);
  const showClear = type === "search" && !!value && !isDisabled;
  const hasLeadingIcon = type === "search";
  const hasTrailingIcon = type === "password" || loading || showClear;

  const inputEl = mask ? (
    <InputMask key={mask} mask={mask} value={value} onChange={handleChange} disabled={isDisabled}>
      {(inputProps: any) => (
        <input
          {...inputProps}
          id={fieldId}
          name={name}
          placeholder={placeholder}
          className={`inp ${effectiveError ? "error" : ""}`}
          maxLength={maxLength}
          disabled={isDisabled}
          autoFocus={autoFocus}
          onBlur={handleBlur}
          style={style}
          aria-invalid={!!effectiveError}
          aria-describedby={errorId ?? hintId}
        />
      )}
    </InputMask>
  ) : (
    <input
      id={fieldId}
      name={name}
      placeholder={placeholder}
      type={nativeType}
      value={isSpecial ? displayValue : value}
      onChange={handleChange}
      onBlur={handleBlur}
      className={[
        "inp",
        effectiveError ? "error" : "",
        hasLeadingIcon ? "inp-pad-left" : "",
        hasTrailingIcon ? "inp-pad-right" : "",
      ].filter(Boolean).join(" ")}
      maxLength={isSpecial ? undefined : maxLength}
      disabled={isDisabled}
      required={required}
      autoFocus={autoFocus}
      autoComplete={autoComplete ?? AUTOCOMPLETE[type]}
      inputMode={INPUT_MODE[type]}
      style={style}
      list={datalistOptions ? `${fieldId}-list` : undefined}
      min={min}
      max={max}
      aria-invalid={!!effectiveError}
      aria-describedby={errorId ?? hintId}
    />
  );

  return (
    <div className="inp-wrap">
      {label && (
        <label htmlFor={fieldId} className="inp-label">
          {label}{required && <span className="inp-required"> *</span>}
        </label>
      )}
      <div className="inp-shell">
        {hasLeadingIcon && <span className="inp-icon inp-icon-left"><SearchGlyph /></span>}
        {inputEl}
        {loading && (
          <span className="inp-icon inp-icon-right inp-icon-static" aria-label="Carregando">
            <Spinner />
          </span>
        )}
        {!loading && showClear && (
          <button
            type="button"
            className="inp-icon inp-icon-right inp-icon-btn"
            onClick={() => onChangeValue?.("")}
            aria-label="Limpar busca"
            tabIndex={-1}
          >
            <ClearGlyph />
          </button>
        )}
        {!loading && type === "password" && (
          <button
            type="button"
            className="inp-icon inp-icon-right inp-icon-btn"
            onClick={() => setPwVisible((v) => !v)}
            aria-label={pwVisible ? "Ocultar senha" : "Mostrar senha"}
            tabIndex={-1}
          >
            <EyeGlyph off={!pwVisible} />
          </button>
        )}
      </div>
      {datalistOptions && (
        <datalist id={`${fieldId}-list`}>
          {datalistOptions.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
      {effectiveError && <span id={errorId} className="inp-error-text">{effectiveError}</span>}
      {!effectiveError && hint && <span id={hintId} className="inp-hint-text">{hint}</span>}
    </div>
  );
}

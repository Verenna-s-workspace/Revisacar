import "./input.css";

export type SelectOption = string | { value: string; label: string; disabled?: boolean };
/** Um grupo nomeado de opções — vira um <optgroup>. Misture livremente com
 * SelectOption soltas no mesmo array quando só parte da lista for agrupada. */
export type SelectOptionGroup = { group: string; options: readonly SelectOption[] };
export type SelectEntry = SelectOption | SelectOptionGroup;

type SelectProps = {
  name: string;
  value: string;
  options: readonly SelectEntry[];
  error?: string;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  id?: string;
  style?: React.CSSProperties;
};

function isGroup(o: SelectEntry): o is SelectOptionGroup {
  return typeof o === "object" && o !== null && "group" in o;
}

function normalize(o: SelectOption): { value: string; label: string; disabled?: boolean } {
  return typeof o === "string" ? { value: o, label: o } : o;
}

export function Select({
  name,
  value,
  options,
  error,
  placeholder,
  onChangeValue,
  label,
  hint,
  disabled,
  loading,
  required,
  autoFocus,
  onBlur,
  id,
  style,
}: SelectProps) {
  const fieldId = id ?? name;
  const isDisabled = !!disabled || !!loading;
  const errorId = error ? `${fieldId}-erro` : undefined;
  const hintId = hint ? `${fieldId}-dica` : undefined;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChangeValue?.(e.target.value);
  }

  return (
    <div className="inp-wrap">
      {label && (
        <label htmlFor={fieldId} className="inp-label">
          {label}{required && <span className="inp-required"> *</span>}
        </label>
      )}
      <div className="inp-shell inp-select-shell">
        <select
          id={fieldId}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          className={`inp ${error ? "error" : ""}`}
          disabled={isDisabled}
          required={required}
          autoFocus={autoFocus}
          style={style}
          aria-invalid={!!error}
          aria-describedby={errorId ?? hintId}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((entry) =>
            isGroup(entry) ? (
              <optgroup key={entry.group} label={entry.group}>
                {entry.options.map(normalize).map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              (() => {
                const o = normalize(entry);
                return (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                );
              })()
            )
          )}
        </select>
        <span className="inp-select-chevron" aria-hidden="true">
          <svg width={11} height={11} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 4.5 6 8l3.5-3.5" />
          </svg>
        </span>
      </div>
      {error && <span id={errorId} className="inp-error-text">{error}</span>}
      {!error && hint && <span id={hintId} className="inp-hint-text">{hint}</span>}
    </div>
  );
}

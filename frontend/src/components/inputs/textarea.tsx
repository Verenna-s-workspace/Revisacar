import "./input.css";

type AreaProps = {
  name: string;
  rows?: number;
  cols?: number;
  value: string;
  error?: string;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  id?: string;
  style?: React.CSSProperties;
};

export function Textarea({
  name,
  rows = 5,
  cols,
  value,
  error,
  onChangeValue,
  placeholder,
  label,
  hint,
  disabled,
  required,
  maxLength,
  autoFocus,
  onBlur,
  id,
  style,
}: AreaProps) {
  const fieldId = id ?? name;
  const errorId = error ? `${fieldId}-erro` : undefined;
  const hintId = hint ? `${fieldId}-dica` : undefined;

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChangeValue?.(e.target.value);
  }

  return (
    <div className="inp-wrap">
      {label && (
        <label htmlFor={fieldId} className="inp-label">
          {label}{required && <span className="inp-required"> *</span>}
        </label>
      )}
      <textarea
        id={fieldId}
        name={name}
        placeholder={placeholder}
        rows={rows}
        cols={cols}
        onChange={handleChange}
        onBlur={onBlur}
        value={value}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className={`inp-textarea ${error ? "error" : ""}`}
        style={style}
        aria-invalid={!!error}
        aria-describedby={errorId ?? hintId}
      />
      {error && <span id={errorId} className="inp-error-text">{error}</span>}
      {!error && hint && <span id={hintId} className="inp-hint-text">{hint}</span>}
      {!error && maxLength && (
        <span className="inp-count-text">{value.length}/{maxLength}</span>
      )}
    </div>
  );
}

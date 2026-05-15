import "./input.css";

type SelectProps = {
  name: string;
  value: string;
  options: string[];
  error?: string;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
};

export function Select({
  name,
  value,
  options,
  error,
  placeholder,
  onChangeValue,
}: SelectProps) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChangeValue?.(e.target.value);
  }

  return (
    <div>
      <select
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        className={`inp ${error ? "error" : ""}`}
      >
        <option value="">{placeholder ?? "—"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      {error && <span>{error}</span>}
    </div>
  );
}
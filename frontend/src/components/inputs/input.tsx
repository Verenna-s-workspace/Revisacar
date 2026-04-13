import "./input.css";
import InputMask from "react-input-mask";

type InputProps = {
  name: string;
  type?: string;
  value: string;
  error?: string;
  onlyNumbers?: boolean;
  onlyText?: boolean;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
  maxLength?: number;
  mask?: string;
};

export function Input({
  name,
  type = "text",
  value,
  error,
  onlyNumbers,
  onChangeValue,
  placeholder,
  onlyText,
  maxLength,
  mask
}: InputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let value = e.target.value;
    
    if (onlyNumbers) {
      value = value.replace(/[^0-9.-]/g, "");
    }
    if (onlyText) {
      value = value.replace(/[^\p{L}\s]/gu, "");
    }
    if (mask) {
       onChangeValue?.(e.target.value);
        return;
}
    onChangeValue?.(value);
  }

 return (
  <div>
    {mask ? (
      <InputMask
        key={mask}
        mask={mask}
        value={value}
        onChange={handleChange}
      >
        {(inputProps: any) => (
          <input
            {...inputProps}
            id={name}
            name={name}
            placeholder={placeholder}
            className={`inp ${error ? 'error' : ''}`}
            maxLength={maxLength}
          />
        )}
      </InputMask>
    ) : (
      <input
        id={name}
        name={name}
        placeholder={placeholder}
        type={type}
        value={value}
         onChange={handleChange}
        className={`inp ${error ? 'error' : ''}`}
        maxLength={maxLength}
      />
    )}

    {error && <span>{error}</span>}
  </div>
);

}

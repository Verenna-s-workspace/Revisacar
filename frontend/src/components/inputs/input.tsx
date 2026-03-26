import './input.css'


type InputProps = { 
  label: string;
  name: string;
  type?: string;
  value: string;
  error?: string;
  onlyNumbers?: boolean;
  onlyText?: boolean;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
};

export function Input({ label, name, type = "text", value, error,onlyNumbers,onChangeValue, placeholder, onlyText}: InputProps) {

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let value = e.target.value;

    if (onlyNumbers) {
      value = value.replace(/\D/g, "");
    }
    if (onlyText){
        value = value.replace(/[^\p{L}\s]/gu, "");
    }
 

 
    onChangeValue?.(value);
  }

  return (
    <div>
      <label htmlFor={name}>{label}</label>

      <input 
        id={name}
        name={name}
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={handleChange}
      />
   

      {error && <span>{error}</span>}
    </div>
  );
}
import './input.css'


type AreaProps = { 
  name: string;
  rows?: number;
  cols?: number;
  value: string;
  error?: string;
  placeholder?: string;
  onChangeValue?: (value: string) => void;
};

export function Textarea({ name, rows= 5, cols= 50, value, error,onChangeValue, placeholder}: AreaProps) {

function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
  const value = e.target.value;
  onChangeValue?.(value);
}

  return (
    <div>
      

      <textarea 
        id={name}
        name={name}
        placeholder={placeholder}
        rows={rows}
        cols={cols}
        onChange={handleChange}
        value={value}
       
      />
   

      {error && <span>{error}</span>}
    </div>
  );
}
import './button.css'

type ButtonProps = {
  texto: string;
};

export default function Button({ texto }: ButtonProps) {
  return (
    <button className='.btn'>{texto}</button>
  );
}
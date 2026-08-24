type Props = {
  onAdd: () => void;
};

export default function AddItemButton({ onAdd }: Props) {
  return (
    <button onClick={onAdd} style={{ padding: "8px 12px" }}>
      + Adicionar peça
    </button>
  );
}
/** Placa Mercosul: identidade do veículo (faixa azul + mono em caixa alta). Tamanho "sm" = tabela. */
export function PlacaMercosul({ placa }: { placa?: string | null }) {
  const texto = (placa ?? '').trim().toUpperCase();
  if (!texto) return <span className="os-vazio">—</span>;
  return (
    <span className="os-placa" role="img" aria-label={`Placa ${texto}`}>
      <span className="os-placa__faixa" aria-hidden="true" />
      <span className="os-placa__texto" aria-hidden="true">{texto}</span>
    </span>
  );
}

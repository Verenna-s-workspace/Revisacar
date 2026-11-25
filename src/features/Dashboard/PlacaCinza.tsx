import './PlacaCinza.css';



/** Placa Mercosul: identidade do veículo (faixa azul + mono em caixa alta). Compartilhada por Ordens e Atendimento. */
export function PlacaCinza({ placa }: { placa?: string | null }) {
  const texto = (placa ?? '').trim().toUpperCase();
  if (!texto) return <span className="placa-cinza-vazia">—</span>;

  return (
    <span className="placa-cinza" role="img" aria-label={`Placa ${texto}`}>
      <div className="placa-cinza__faixa" aria-hidden="true">
        <div className='placa-cinza__furo'></div>
        <span className='placa-cinza__pais'>BR-BRASIL</span>
        <div className='placa-cinza__furo'></div>
      </div>
      <span className="placa-cinza__texto" aria-hidden="true">{texto}</span>
    </span>
  );
}
import './PlacaMercosul.css';
import bandeiraBrasil from './Flag_of_Brazil.svg';

/** Placa Mercosul: identidade do veículo (faixa azul + mono em caixa alta). Compartilhada por Ordens e Atendimento. */
export function PlacaMercosul({ placa }: { placa?: string | null }) {
  const texto = (placa ?? '').trim().toUpperCase();
  if (!texto) return <span className="placa-merc-vazia">—</span>;

  return (
    <span className="placa-merc" role="img" aria-label={`Placa ${texto}`}>
      <span className="placa-merc__faixa" aria-hidden="true">
        <img 
          src={bandeiraBrasil} 
          alt="" 
          className="placa-merc__bandeira" 
        />
      </span>
      <span className="placa-merc__texto" aria-hidden="true">{texto}</span>
    </span>
  );
}
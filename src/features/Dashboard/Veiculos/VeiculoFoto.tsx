import { CarroCategoriaSvg } from './ilustracoes';
import type { VeiculoCategoria } from '../../../types/veiculo';

interface VeiculoFotoProps {
  /** Foto principal cadastrada do veículo. Ausente = ilustração da categoria do veículo. */
  src?: string;
  /** Categoria de carroceria: define qual ilustração aparece quando não há foto. */
  categoria: VeiculoCategoria;
}

/**
 * Miniatura do veículo no início da linha. Segue o mesmo padrão estrutural e
 * visual de EstoqueFoto (`src/features/Dashboard/Estoque/EstoqueFoto.tsx`); sem
 * foto, mostra o carro isométrico da categoria em vez das caixas do Estoque.
 */
export function VeiculoFoto({ src, categoria }: VeiculoFotoProps) {
  return (
    <span className="ve-foto">
      {src
        ? <img className="ve-foto__img" src={src} alt="" loading="lazy" />
        : <CarroCategoriaSvg categoria={categoria} className="ve-foto__padrao" />}
    </span>
  );
}

import { CaixasEmpilhadasSvg } from '../Estoque/ilustracoes';

interface VeiculoFotoProps {
  /** Foto principal cadastrada do veículo. Ausente = mesmo padrão genérico do Estoque. */
  src?: string;
}

/**
 * Miniatura do veículo no início da linha. Segue exatamente o mesmo padrão
 * estrutural e visual de EstoqueFoto (`src/features/Dashboard/Estoque/EstoqueFoto.tsx`).
 */
export function VeiculoFoto({ src }: VeiculoFotoProps) {
  return (
    <span className="ve-foto">
      {src
        ? <img className="ve-foto__img" src={src} alt="" loading="lazy" />
        : <CaixasEmpilhadasSvg className="ve-foto__padrao" />}
    </span>
  );
}
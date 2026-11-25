import { CaixasEmpilhadasSvg } from './ilustracoes';

interface EstoqueFotoProps {
  /** Foto cadastrada pela oficina (data URL). Ausente = ilustração das três caixas. */
  src?: string;
}

/**
 * Miniatura do produto/kit no início da linha. Decorativa: o nome já está ao
 * lado, então a imagem não repete texto pro leitor de tela.
 */
export function EstoqueFoto({ src }: EstoqueFotoProps) {
  return (
    <span className="es-foto">
      {src
        ? <img className="es-foto__img" src={src} alt="" loading="lazy" />
        : <CaixasEmpilhadasSvg className="es-foto__padrao" />}
    </span>
  );
}

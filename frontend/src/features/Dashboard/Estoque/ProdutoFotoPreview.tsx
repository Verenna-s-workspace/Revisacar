import { CaixasEmpilhadasSvg } from './ilustracoes';
import './produtoModal.css';

/** Prévia 4:3 da foto do produto/kit; sem foto, a ilustração das três caixas (a mesma da lista). */
export function ProdutoFotoPreview({ foto, alt = 'Foto do produto' }: { foto?: string; alt?: string }) {
  return (
    <div className="pf-tile">
      {foto
        ? <img className="pf-tile__img" src={foto} alt={alt} />
        : <CaixasEmpilhadasSvg className="pf-tile__padrao" />}
    </div>
  );
}

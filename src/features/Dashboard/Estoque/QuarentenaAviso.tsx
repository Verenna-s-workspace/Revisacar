import { Valor } from '../../../components/Privacidade';
import { formatBRL } from '../../../utils/dashboard';
import { resumoQuarentena } from '../../../utils/estoque_utils';
import type { EstoqueItem } from '../../../types/estoque';
import { IcAlerta } from './icones';

/**
 * Aviso de peças em quarentena (aguardando devolução/garantia) no visual novo.
 * Mesmo resumo e mesmo texto do QuarentenaAlert (que segue no celular); usa a
 * paleta do status "pendente de aprovação" da OS, já que o amarelo deixou de
 * ser a cor do estoque baixo.
 */
export function QuarentenaAviso({ itens }: { itens: EstoqueItem[] }) {
  const resumo = resumoQuarentena(itens);
  if (!resumo) return null;

  return (
    <div className="es-aviso os-status--pendente_aprovacao" role="status">
      <span className="es-aviso__icone">{IcAlerta}</span>
      <p className="es-aviso__texto">
        <strong><Valor texto={formatBRL(resumo.valorTotal)} /></strong> em {resumo.totalPecas}{' '}
        {resumo.totalPecas === 1 ? 'peça' : 'peças'} aguardando devolução/garantia
        {resumo.diasMaisAntigo > 0 && (
          <>, a mais antiga há {resumo.diasMaisAntigo} {resumo.diasMaisAntigo === 1 ? 'dia' : 'dias'}</>
        )}
        .
      </p>
    </div>
  );
}

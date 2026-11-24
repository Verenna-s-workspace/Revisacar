import { labelCategoria, LABEL_STATUS } from './categoriaLabels';
import type { Transacao } from './types';

/** Nome que aparece na lista: a descrição, ou a categoria quando o lançamento não tem descrição. */
export const nomeDoLancamento = (t: Transacao) => t.descricao || labelCategoria(t.tipo, t.categoria);

/** "Vencido" é calculado pelo backend na leitura; nunca vira status gravado. */
export const rotuloStatus = (t: { status: string; vencido: boolean }) => (t.vencido ? 'Vencido' : LABEL_STATUS[t.status] ?? t.status);

/** Classe de cor do selo (as mesmas variáveis --st-* de Ordens/Status.css). Cancelado fica neutro. */
export const classeStatus = (t: Transacao) => {
  if (t.vencido) return 'os-status--recusada';
  if (t.status === 'pago') return 'os-status--finalizada';
  if (t.status === 'cancelado') return '';
  return 'os-status--pendente_aprovacao';
};

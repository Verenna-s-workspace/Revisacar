// "Cliente avisado" agora vive no banco (ordens.cliente_avisado, script alertas.sql).
// Antes ficava só no navegador (overlay do Atendimento); estas funções cuidam da transição.
import { api } from './api';
import { corpoDoErro } from './api_erro';
import { lerTodosOverlays, salvarOverlay } from './atendimento_utils';
import type { OrdemRow } from '../types/dashboard';

/** O backend respondeu que alertas.sql ainda não foi rodado (marcação não existe no banco). */
export function scriptDeAvisadoAusente(e: unknown): boolean {
  const detalhe = corpoDoErro<{ detail?: string }>(e)?.detail;
  return typeof detalhe === 'string' && detalhe.includes('alertas.sql');
}

const JA_TENTADAS = new Set<string>();
const MAX_POR_VEZ = 20;

/**
 * Sobe pro banco as marcações "cliente avisado" que só existiam neste navegador.
 * Só age quando o banco já tem a coluna (`cliente_avisado` booleano na listagem) e
 * a OS está concluída; cada OS é tentada uma vez por sessão. Devolve os ids que
 * foram gravados (a tela pode atualizar a lista sem recarregar).
 */
export async function migrarAvisadosLocais(ordens: OrdemRow[]): Promise<string[]> {
  let overlays;
  try { overlays = lerTodosOverlays(); } catch { return []; }
  const pendentes = ordens
    .filter(o => o.status === 'finalizada' && o.cliente_avisado === false && overlays[o.id]?.clienteAvisado === true && !JA_TENTADAS.has(o.id))
    .slice(0, MAX_POR_VEZ);
  const feitos: string[] = [];
  for (const o of pendentes) {
    JA_TENTADAS.add(o.id);
    try {
      await api.marcarClienteAvisado(o.id, true);
      salvarOverlay(o.id, { clienteAvisado: undefined });
      feitos.push(o.id);
    } catch {
      // sem permissão ou fora do ar: o valor local continua valendo pra esta sessão
    }
  }
  return feitos;
}

import { useAlertas } from './useAlertas';

/**
 * Só o total, pro bloco de alertas da sidebar e o sino. É uma visão por cima de
 * useAlertas(): a regra de cada alerta mora em utils/alertas.ts, então o número e a
 * tela de Alertas nunca divergem.
 */
export function useAlertasResumo() {
  const { total, loading } = useAlertas();
  return { total, loading };
}

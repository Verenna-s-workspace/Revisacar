import { useMemo } from 'react';
import { useAlertas } from './useAlertas';
import { contarPorFonte } from '../utils/alertas';

export interface AlertasResumo {
  bloqueados: number;
  clientesNaoAvisados: number;
  baixoEstoque: number;
  quarentena: number;
  total: number;
}

/**
 * Contagem pro bloco de alertas da sidebar, sino e card do painel. É só uma visão
 * por cima de useAlertas(): a regra de cada alerta mora em utils/alertas.ts, então
 * a contagem e a tela de Alertas nunca divergem.
 *
 * Roda quando o componente que usa monta (sidebar/topbar montam a cada página).
 */
export function useAlertasResumo() {
  const { alertas, total, loading } = useAlertas();
  const resumo = useMemo<AlertasResumo>(() => ({
    bloqueados: contarPorFonte(alertas, 'os_bloqueada'),
    clientesNaoAvisados: contarPorFonte(alertas, 'cliente_nao_avisado'),
    baixoEstoque: contarPorFonte(alertas, 'estoque_baixo'),
    quarentena: contarPorFonte(alertas, 'estoque_quarentena'),
    total,
  }), [alertas, total]);
  return { ...resumo, loading };
}

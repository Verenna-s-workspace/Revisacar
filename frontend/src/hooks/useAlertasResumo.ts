import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { isSameDay } from '../utils/agenda';
import { lerTodosOverlays, mesclarOverlayNaOrdem, buildSeedOrdensAtendimento } from '../utils/atendimento_utils';
import { itemEstaBaixo, buildSeedEstoque } from '../utils/estoque_utils';
import type { OrdemRow } from '../types/dashboard';
import type { EstoqueItem } from '../types/estoque';

export interface AlertasResumo {
  bloqueados: number;
  clientesNaoAvisados: number;
  baixoEstoque: number;
  quarentena: number;
  total: number;
}

const VAZIO: AlertasResumo = { bloqueados: 0, clientesNaoAvisados: 0, baixoEstoque: 0, quarentena: 0, total: 0 };

function contar(ordens: OrdemRow[], itens: EstoqueItem[]): AlertasResumo {
  const overlays = lerTodosOverlays();
  const ordensComOverlay = ordens.map(o => mesclarOverlayNaOrdem(o, overlays));

  const bloqueados = ordensComOverlay.filter(o => o.status === 'aguardando').length;
  const clientesNaoAvisados = ordensComOverlay.filter(
    o => o.status === 'finalizada' && isSameDay(new Date(o.updated_at), new Date()) && o.clienteAvisado !== true
  ).length;
  const baixoEstoque = itens.filter(itemEstaBaixo).length;
  const quarentena = itens.filter(i => i.status === 'quarentena').length;

  return { bloqueados, clientesNaoAvisados, baixoEstoque, quarentena, total: bloqueados + clientesNaoAvisados + baixoEstoque + quarentena };
}

/**
 * Contagem leve pro Bloco de Alertas da sidebar — não reaproveita useAtendimento()/
 * useEstoque() inteiros (fazem mais trabalho do que essa contagem precisa: derivação
 * de Kanban, vínculo de kits). Busca só o que precisa pra contar, reaproveitando os
 * mesmos predicados dos hooks completos (itemEstaBaixo, mesclarOverlayNaOrdem,
 * isSameDay) pra nunca duplicar a regra em dois lugares.
 *
 * Roda uma vez quando o shell (Dashboard.tsx) monta — não a cada navegação. Mesmo
 * padrão de fallback restrito a DEV que Relatórios/Estoque/Atendimento já usam: é
 * dado operacional, não mostra número fictício em produção.
 */
export function useAlertasResumo() {
  const [resumo, setResumo] = useState<AlertasResumo>(VAZIO);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [ordens, itens] = await Promise.all([api.listarOrdens(), api.listarEstoque()]);
        if (!cancelado) setResumo(contar(ordens, itens));
      } catch {
        if (!cancelado && import.meta.env.DEV) {
          setResumo(contar(buildSeedOrdensAtendimento(), buildSeedEstoque()));
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return { ...resumo, loading };
}

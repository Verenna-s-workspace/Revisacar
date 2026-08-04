import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import {
  buildSeedOrdensAtendimento,
  derivarColunasKanban,
  lerTodosOverlays,
  mesclarOverlayNaOrdem,
  salvarOverlay,
} from '../utils/atendimento_utils';
import { isSameDay } from '../utils/agenda';
import { useAgendamentos } from './useAgendamentos';
import type { ColunasKanban, OSAtendimento, OverlayOS } from '../types/atendimento';
import type { OrdemRow } from '../types/dashboard';

export interface ResumoOperacional {
  emExecucao: number;
  bloqueados: number;
  finalizadosHoje: number;
}

export function useAtendimento() {
  const [ordensRaw, setOrdensRaw] = useState<OrdemRow[]>([]);
  const [loadingOrdens, setLoadingOrdens] = useState(true);
  // Incrementado a cada gravação no overlay pra forçar a releitura do
  // localStorage — o overlay é síncrono e vive fora do React, então não há
  // outro jeito de "notificar" o hook de que ele mudou.
  const [overlayVersion, setOverlayVersion] = useState(0);

  const {
    agendamentos,
    loading: loadingAgendamentos,
    reload: reloadAgendamentos,
  } = useAgendamentos();

  const carregarOrdens = useCallback(async () => {
    setLoadingOrdens(true);
    try {
      const data = await api.listarOrdens();
      const lista: OrdemRow[] = Array.isArray(data) ? data : [];
      // Fallback de demo só em desenvolvimento — ver comentário em
      // buildSeedOrdensAtendimento (mesmo racional do useEstoque).
      setOrdensRaw(lista.length === 0 && import.meta.env.DEV ? buildSeedOrdensAtendimento() : lista);
    } catch {
      setOrdensRaw(import.meta.env.DEV ? buildSeedOrdensAtendimento() : []);
    } finally {
      setLoadingOrdens(false);
    }
  }, []);

  useEffect(() => {
    carregarOrdens();
  }, [carregarOrdens]);

  const overlays = useMemo(() => lerTodosOverlays(), [overlayVersion]);

  const ordens: OSAtendimento[] = useMemo(
    () => ordensRaw.map(o => mesclarOverlayNaOrdem(o, overlays)),
    [ordensRaw, overlays]
  );

  const colunas: ColunasKanban = useMemo(
    () => derivarColunasKanban(ordens, agendamentos),
    [ordens, agendamentos]
  );

  const resumo: ResumoOperacional = useMemo(
    () => ({
      emExecucao: colunas.em_execucao.length,
      bloqueados: colunas.bloqueado.length,
      finalizadosHoje: colunas.concluido.length,
    }),
    [colunas]
  );

  // Clientes finalizados hoje que ainda não foram marcados como avisados —
  // alimenta o card vermelho (Seção 5, item 4).
  const clientesNaoAvisados: OSAtendimento[] = useMemo(
    () =>
      ordens.filter(
        o => o.status === 'finalizada' && isSameDay(new Date(o.updated_at), new Date()) && o.clienteAvisado !== true
      ),
    [ordens]
  );

  // Próximo agendamento de hoje que ainda não começou (sem OS ainda) e cujo
  // horário ainda não passou — null se não sobrar nenhum.
  const proximoAgendamento = useMemo(() => {
    const agora = new Date();
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    const proximo = colunas.fila.find(
      item => item.tipo === 'agendamento' && item.agendamento.horaInicio >= horaAtual
    );
    return proximo?.tipo === 'agendamento' ? proximo.agendamento : null;
  }, [colunas]);

  const atualizarOverlay = useCallback((ordemId: string, patch: Partial<Omit<OverlayOS, 'ordemId'>>) => {
    salvarOverlay(ordemId, patch);
    setOverlayVersion(v => v + 1);
  }, []);

  // Idempotente por design: só grava iniciadoEm na 1ª vez. Chamar de novo em
  // cima de uma OS que já começou não faz nada — nunca existe um botão
  // dedicado "marcar como iniciado" (ver Seção 4 do prompt).
  const garantirIniciado = useCallback(
    (ordemId: string) => {
      const atual = lerTodosOverlays()[ordemId];
      if (!atual?.iniciadoEm) {
        atualizarOverlay(ordemId, { iniciadoEm: new Date().toISOString() });
      }
    },
    [atualizarOverlay]
  );

  const reload = useCallback(() => {
    carregarOrdens();
    reloadAgendamentos();
  }, [carregarOrdens, reloadAgendamentos]);

  return {
    loading: loadingOrdens || loadingAgendamentos,
    ordens,
    agendamentos,
    colunas,
    resumo,
    clientesNaoAvisados,
    proximoAgendamento,
    atualizarOverlay,
    garantirIniciado,
    reload,
  };
}

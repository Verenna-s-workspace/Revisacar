import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../utils/api';
import {
  derivarColunasKanban,
  lerTodosOverlays,
  mesclarOverlayNaOrdem,
  momentoConclusao,
  salvarOverlay,
} from '../utils/atendimento_utils';
import { isSameDay } from '../utils/agenda';
import { migrarAvisadosLocais, scriptDeAvisadoAusente } from '../utils/cliente_avisado';
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
  const [erroOrdens, setErroOrdens] = useState<string | null>(null);
  // Incrementado a cada gravação no overlay pra forçar a releitura do
  // localStorage — o overlay é síncrono e vive fora do React, então não há
  // outro jeito de "notificar" o hook de que ele mudou.
  const [overlayVersion, setOverlayVersion] = useState(0);

  const {
    agendamentos,
    loading: loadingAgendamentos,
    erro: erroAgendamentos,
    reload: reloadAgendamentos,
  } = useAgendamentos();

  const carregarOrdens = useCallback(async () => {
    setLoadingOrdens(true);
    setErroOrdens(null);
    try {
      const data = await api.listarOrdens();
      const lista: OrdemRow[] = Array.isArray(data) ? data : [];
      setOrdensRaw(lista);
      // Marcações antigas de "cliente avisado" (só no navegador) sobem pro banco, uma vez.
      void migrarAvisadosLocais(lista).then(ids => {
        if (ids.length) {
          setOrdensRaw(prev => prev.map(o => (ids.includes(o.id) ? { ...o, cliente_avisado: true } : o)));
          setOverlayVersion(v => v + 1);
        }
      });
    } catch {
      setOrdensRaw([]);
      setErroOrdens('Não foi possível carregar as ordens de serviço.');
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
        o => o.status === 'finalizada' && isSameDay(new Date(momentoConclusao(o)), new Date()) && o.clienteAvisado !== true
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

  // Tira a OS do estado 'aguardando', devolvendo pra 'rascunho' — reaparece em
  // "Em Execução" se iniciadoEm já existia (retomando o trabalho), ou em
  // "Fila" se nunca chegou a começar. Otimista: atualiza a lista local antes
  // da resposta da API; se a chamada falhar, recarrega pra não deixar a tela
  // mentindo que desbloqueou quando não desbloqueou de verdade.
  const desbloquear = useCallback(
    async (ordemId: string) => {
      setOrdensRaw(prev => prev.map(o => (o.id === ordemId ? { ...o, status: 'rascunho' } : o)));
      atualizarOverlay(ordemId, { motivoBloqueio: undefined });
      try {
        await api.definirStatusOrdem(ordemId, 'rascunho');
      } catch {
        carregarOrdens();
      }
    },
    [atualizarOverlay, carregarOrdens]
  );

  // "Cliente avisado" é gravado no banco (vale pra equipe toda e pra qualquer aparelho).
  // Otimista; se o script alertas.sql ainda não foi rodado, guarda só neste navegador como antes.
  const marcarClienteAvisado = useCallback(
    async (ordemId: string, avisado: boolean) => {
      setOrdensRaw(prev => prev.map(o => (o.id === ordemId ? { ...o, cliente_avisado: avisado } : o)));
      try {
        await api.marcarClienteAvisado(ordemId, avisado);
      } catch (e) {
        if (scriptDeAvisadoAusente(e)) {
          setOrdensRaw(prev => prev.map(o => {
            if (o.id !== ordemId) return o;
            const { cliente_avisado: _descartado, ...resto } = o;
            return resto;
          }));
          atualizarOverlay(ordemId, { clienteAvisado: avisado });
        } else {
          carregarOrdens();
          setErroOrdens('Não foi possível salvar "cliente avisado". Tente de novo.');
        }
      }
    },
    [atualizarOverlay, carregarOrdens]
  );

  const reload = useCallback(() => {
    carregarOrdens();
    reloadAgendamentos();
  }, [carregarOrdens, reloadAgendamentos]);

  return {
    loading: loadingOrdens || loadingAgendamentos,
    erro: erroOrdens ?? erroAgendamentos ?? null,
    ordens,
    agendamentos,
    colunas,
    resumo,
    clientesNaoAvisados,
    proximoAgendamento,
    atualizarOverlay,
    garantirIniciado,
    desbloquear,
    marcarClienteAvisado,
    reload,
  };
}

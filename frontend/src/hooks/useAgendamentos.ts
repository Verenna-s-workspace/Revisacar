import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { mensagemDeErro } from '../utils/erros';
import type {
  Agendamento,
  AppointmentStatus,
  AppointmentReschedule,
  NovoAgendamentoInput,
} from '../types/agendamento';
import {
  toISODate,
  addDays,
  timeToMinutes,
  minutesToTime,
  DEFAULT_DURATION_MINUTES,
} from '../utils/agenda';
import { lerHorarioFuncionamento } from '../utils/horario_funcionamento';

/** Confere se [horaInicio, horaFim) cabe inteiro dentro do horário de
 * funcionamento configurado — segunda camada de proteção além do seletor de
 * horário (que já só oferece slots válidos), pra nunca aceitar um
 * agendamento fora do expediente independente de como ele chegue aqui. */
function dentroDoHorarioFuncionamento(horaInicio: string, horaFim: string): boolean {
  const { horaAbertura, horaFechamento } = lerHorarioFuncionamento();
  return timeToMinutes(horaInicio) >= timeToMinutes(horaAbertura) && timeToMinutes(horaFim) <= timeToMinutes(horaFechamento);
}

const sortAgendamentos = (lista: Agendamento[]): Agendamento[] =>
  [...lista].sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return a.horaInicio < b.horaInicio ? -1 : a.horaInicio > b.horaInicio ? 1 : 0;
  });

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface AgendamentoStats {
  hoje: number;
  emAndamento: number;
  aguardandoPagamento: number;
  concluidos: number;
  cancelados: number;
}

export function useAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const agendamentosRef = useRef<Agendamento[]>([]);
  agendamentosRef.current = agendamentos;
  const [loading, setLoading] = useState(true);
  const [usingApi, setUsingApi] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Se a API falhar, mostra o erro real (nunca dados fictícios). Uma resposta bem
  // sucedida, mesmo com lista vazia, é sempre exibida como veio.
  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await api.listarAgendamentos();
      const lista: Agendamento[] = Array.isArray(data) ? data : [];
      setAgendamentos(sortAgendamentos(lista));
      setUsingApi(true);
    } catch {
      setAgendamentos([]);
      setUsingApi(false);
      setErro('Não foi possível carregar os agendamentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addAgendamento = useCallback(async (input: NovoAgendamentoInput) => {
    if (!dentroDoHorarioFuncionamento(input.horaInicio, input.horaFim)) {
      throw new Error('Esse horário está fora do funcionamento da oficina.');
    }
    const novo: Agendamento = {
      id: `local-${Date.now()}`,
      status: 'agendado',
      createdAt: new Date().toISOString(),
      ...input,
    };
    setAgendamentos(prev => sortAgendamentos([...prev, novo]));

    if (usingApi) {
      try {
        const saved: Agendamento = await api.criarAgendamento(novo);
        setAgendamentos(prev => sortAgendamentos(prev.map(a => (a.id === novo.id ? { ...novo, ...saved } : a))));
        return { ...novo, ...saved };
      } catch (e) {
        setAgendamentos(prev => prev.filter(a => a.id !== novo.id));
        throw new Error(mensagemDeErro(e, 'Não foi possível salvar o agendamento. Tente novamente.'));
      }
    }
    return novo;
  }, [usingApi]);

  const updateAgendamento = useCallback(async (id: string, changes: Partial<Agendamento>) => {
    const anterior = agendamentosRef.current.find(a => a.id === id);
    setAgendamentos(prev =>
      sortAgendamentos(
        prev.map(a => (a.id === id ? { ...a, ...changes, updatedAt: new Date().toISOString() } : a))
      )
    );
    if (usingApi) {
      try {
        const saved: Agendamento = await api.atualizarAgendamento(id, changes);
        if (saved?.id) setAgendamentos(prev => sortAgendamentos(prev.map(a => (a.id === id ? { ...a, ...saved } : a))));
      } catch (e) {
        if (anterior) setAgendamentos(prev => sortAgendamentos(prev.map(a => (a.id === id ? anterior : a))));
        throw new Error(mensagemDeErro(e, 'Não foi possível atualizar o agendamento. Tente novamente.'));
      }
    }
  }, [usingApi]);

  const updateStatus = useCallback(
    (id: string, status: AppointmentStatus) => updateAgendamento(id, { status }),
    [updateAgendamento]
  );

  const cancelAgendamento = useCallback(
    (id: string) => updateAgendamento(id, { status: 'cancelado' }),
    [updateAgendamento]
  );

  const rescheduleAgendamento = useCallback(
    (id: string, novaData: string, novaHora: string) => {
      setAgendamentos(prev =>
        sortAgendamentos(
          prev.map(a => {
            if (a.id !== id) return a;
            const duracao = Math.max(timeToMinutes(a.horaFim) - timeToMinutes(a.horaInicio), DEFAULT_DURATION_MINUTES);
            const novoFim = minutesToTime(timeToMinutes(novaHora) + duracao);
            if (!dentroDoHorarioFuncionamento(novaHora, novoFim)) {
              // Não deveria acontecer pelo seletor de horário (só oferece
              // slots dentro do expediente), mas não aceita silenciosamente
              // um reagendamento fora do horário se chegar aqui de outro jeito.
              console.warn('Reagendamento rejeitado: fora do horário de funcionamento.', { id, novaData, novaHora });
              return a;
            }
            const reagendamento: AppointmentReschedule = {
              dataAnterior: a.data,
              horaAnterior: a.horaInicio,
              novaData,
              novaHora,
            };
            const changes: Agendamento = {
              ...a,
              data: novaData,
              horaInicio: novaHora,
              horaFim: novoFim,
              reagendamento,
              updatedAt: new Date().toISOString(),
            };
            if (usingApi) {
              api.atualizarAgendamento(id, changes).catch(() => {});
            }
            return changes;
          })
        )
      );
    },
    [usingApi]
  );

  // ── Derivados ────────────────────────────────────────────────────────────

  const stats = useMemo<AgendamentoStats>(() => {
    const todayISO = toISODate(new Date());
    return {
      hoje: agendamentos.filter(a => a.data === todayISO && a.status !== 'cancelado').length,
      emAndamento: agendamentos.filter(a => a.status === 'em_andamento').length,
      aguardandoPagamento: agendamentos.filter(a => a.status === 'aguardando_pagamento').length,
      concluidos: agendamentos.filter(a => a.status === 'concluido').length,
      cancelados: agendamentos.filter(a => a.status === 'cancelado').length,
    };
  }, [agendamentos]);

  /** Horários ocupados (não cancelados) em uma data específica — usado no modal de novo agendamento. */
  const getOcupados = useCallback(
    (data: string, excludeId?: string) =>
      agendamentos
        .filter(a => a.data === data && a.status !== 'cancelado' && a.id !== excludeId)
        .map(a => ({ horaInicio: a.horaInicio, horaFim: a.horaFim, id: a.id })),
    [agendamentos]
  );

  return {
    agendamentos,
    loading,
    usingApi,
    erro,
    stats,
    reload: load,
    addAgendamento,
    updateAgendamento,
    updateStatus,
    cancelAgendamento,
    rescheduleAgendamento,
    getOcupados,
  };
}

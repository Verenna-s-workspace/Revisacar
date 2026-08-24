import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../utils/api';
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

/**
 * Hook para gerenciamento de agendamentos. Agora chama a API diretamente e,
 * em caso de erro, retorna um array vazio (não há mais fallback para dados de
 * demonstração).
 */
export function useAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarAgendamentos();
      if (Array.isArray(data) && data.length > 0) {
        setAgendamentos(sortAgendamentos(data));
      } else {
        setAgendamentos([]);
      }
    } catch (error) {
      console.error('Failed to fetch appointments', error);
      setAgendamentos([]); // No fallback to seed data; return empty list on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addAgendamento = useCallback(async (input: NovoAgendamentoInput) => {
    const novo: Agendamento = {
      id: `local-${Date.now()}`,
      status: 'agendado',
      createdAt: new Date().toISOString(),
      ...input,
    };

    // Optimistic update
    setAgendamentos(prev => sortAgendamentos([...prev, novo]));

    try {
      const saved = await api.criarAgendamento(novo);
      if (saved?.id) {
        // Replace the optimistic item with the saved one
        setAgendamentos(prev =>
          sortAgendamentos(prev.map(a => (a.id === novo.id ? { ...novo, ...saved } : a)))
        );
      }
    } catch (error) {
      // Rollback optimistic update on failure
      setAgendamentos(prev => prev.filter(a => a.id !== novo.id));
      console.error('Failed to create appointment', error);
      throw error;
    }

    return novo;
  }, []);

  const updateAgendamento = useCallback(async (id: string, changes: Partial<Agendamento>) => {
    // Optimistic update
    setAgendamentos(prev =>
      sortAgendamentos(
        prev.map(a => (a.id === id ? { ...a, ...changes, updatedAt: new Date().toISOString() } : a))
      )
    );

    try {
      await api.atualizarAgendamento(id, changes);
    } catch (error) {
      // Rollback optimistic update on failure
      setAgendamentos(prev =>
        sortAgendamentos(
          prev.map(a => (a.id === id ? { ...a, updatedAt: undefined } : a))
        )
      );
      console.error('Failed to update appointment', error);
      throw error;
    }
  }, []);

  const updateStatus = useCallback(
    (id: string, status: AppointmentStatus) => updateAgendamento(id, { status }),
    [updateAgendamento]
  );

  const cancelAgendamento = useCallback(
    (id: string) => updateAgendamento(id, { status: 'cancelado' }),
    [updateAgendamento]
  );

  const rescheduleAgendamento = useCallback(
    async (id: string, novaData: string, novaHora: string) => {
      // Find the current appointment to calculate duration and build reagendamento
      const currentAppointment = agendamentos.find(a => a.id === id);
      if (!currentAppointment) {
        throw new Error('Appointment not found');
      }

      const duracao = Math.max(
        timeToMinutes(currentAppointment.horaFim) - timeToMinutes(currentAppointment.horaInicio),
        DEFAULT_DURATION_MINUTES
      );

      // Build the updated appointment object
      const updatedAppointment: Agendamento = {
        ...currentAppointment,
        data: novaData,
        horaInicio: novaHora,
        horaFim: minutesToTime(timeToMinutes(novaHora) + duracao),
        reagendamento: {
          dataAnterior: currentAppointment.data,
          horaAnterior: currentAppointment.horaInicio,
          novaData,
          novaHora,
        },
        updatedAt: new Date().toISOString(),
      };

      // Optimistic update: update the appointment immediately
      setAgendamentos(prev =>
        sortAgendamentos(
          prev.map(a => (a.id === id ? updatedAppointment : a))
        )
      );

      try {
        // Persist the change via API
        await api.atualizarAgendamento(id, updatedAppointment);
      } catch (error) {
        // Rollback optimistic update on failure
        setAgendamentos(prev =>
          sortAgendamentos(
            prev.map(a => (a.id === id ? currentAppointment : a))
          )
        );
        console.error('Failed to reschedule appointment', error);
        throw error;
      }
    },
    [agendamentos] // We depend on agendamentos because we read it to find the current appointment
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
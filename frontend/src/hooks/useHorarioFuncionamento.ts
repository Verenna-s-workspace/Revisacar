import { useEffect, useState } from 'react';
import { getAgendaHours, getTimeSlots } from '../utils/agenda';
import {
  HORARIO_ATUALIZADO_EVENTO,
  lerHorarioFuncionamento,
  type HorarioFuncionamento,
} from '../utils/horario_funcionamento';

/**
 * Horário de funcionamento configurado em Configurações, mais as horas/slots
 * já derivados dele — usado pelas views de Agendamento (seletor de horário,
 * grades Diária/Semanal). Reage tanto a mudanças salvas nesta mesma aba
 * (evento customizado, disparado ao salvar em Configurações) quanto em
 * outras abas (evento nativo `storage`), então nenhuma tela de Agendamento
 * já aberta fica com o horário antigo depois de uma mudança.
 */
export function useHorarioFuncionamento() {
  const [horario, setHorario] = useState<HorarioFuncionamento>(lerHorarioFuncionamento);

  useEffect(() => {
    const atualizar = () => setHorario(lerHorarioFuncionamento());
    window.addEventListener(HORARIO_ATUALIZADO_EVENTO, atualizar);
    window.addEventListener('storage', atualizar);
    return () => {
      window.removeEventListener(HORARIO_ATUALIZADO_EVENTO, atualizar);
      window.removeEventListener('storage', atualizar);
    };
  }, []);

  return {
    horaAbertura: horario.horaAbertura,
    horaFechamento: horario.horaFechamento,
    agendaHours: getAgendaHours(horario.horaAbertura, horario.horaFechamento),
    timeSlots: getTimeSlots(horario.horaAbertura, horario.horaFechamento),
  };
}

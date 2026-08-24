// ── Agendamentos: tipos ───────────────────────────────────────────────────────

/** Status possíveis de um agendamento (ciclo de vida completo). */
export type AppointmentStatus =
  | 'agendado'
  | 'em_andamento'
  | 'aguardando_pagamento'
  | 'pronto_retirada'
  | 'concluido'
  | 'cancelado';

/** Histórico de remarcação — preenchido quando o agendamento é reagendado. */
export interface AppointmentReschedule {
  dataAnterior: string;  // YYYY-MM-DD
  horaAnterior?: string; // HH:MM
  novaData: string;      // YYYY-MM-DD
  novaHora?: string;     // HH:MM
  motivo?: string;
}

/** Registro de agendamento exibido na agenda. */
export interface Agendamento {
  id: string;
  cliente: string;
  veiculo: string;
  placa: string;
  data: string;        // YYYY-MM-DD
  horaInicio: string;  // HH:MM
  horaFim: string;     // HH:MM
  titulo: string;
  descricao: string;
  status: AppointmentStatus;
  mecanico?: string;
  reagendamento?: AppointmentReschedule;
  ordemServicoId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload utilizado para criar um novo agendamento (Etapas 1 + 2 do modal). */
export interface NovoAgendamentoInput {
  data: string;
  horaInicio: string;
  horaFim: string;
  cliente: string;
  veiculo: string;
  placa: string;
  titulo: string;
  descricao: string;
}

/** Modos de visualização da agenda. */
export type AgendaViewMode = 'mensal' | 'semanal' | 'diario';

/** Período relativo usado no filtro de data. */
export type AgendaPeriodo = 'todos' | 'hoje' | 'semana' | 'mes';

/** Estado atual dos filtros aplicados à listagem. */
export interface AgendaFiltros {
  status: AppointmentStatus | 'todos';
  periodo: AgendaPeriodo;
}

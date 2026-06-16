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

// ── Dados de demonstração ─────────────────────────────────────────────────────
// Gerados de forma relativa a "hoje" para que a agenda sempre pareça povoada,
// independentemente da data em que o app for aberto. Usados como fallback
// enquanto o endpoint `/agendamentos` não estiver disponível no backend.

interface SeedTemplate {
  offsetDias: number;
  horaInicio: string;
  horaFim: string;
  cliente: string;
  veiculo: string;
  placa: string;
  titulo: string;
  descricao: string;
  status: AppointmentStatus;
  mecanico?: string;
  reagendadoDe?: { offsetDias: number; horaInicio: string };
}

const SEED_TEMPLATES: SeedTemplate[] = [
  // ── Hoje ──────────────────────────────────────────────────────────────────
  {
    offsetDias: 0, horaInicio: '08:00', horaFim: '09:30',
    cliente: 'Carlos Eduardo Oliveira', veiculo: 'BMW 320i M-Sport', placa: 'BRA2E19',
    titulo: 'Revisão de 40.000km',
    descricao: 'Revisão completa de 40.000km conforme manual do fabricante, com troca de óleo sintético, filtros e checagem geral dos sistemas de segurança.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 0, horaInicio: '10:00', horaFim: '12:00',
    cliente: 'Fernanda Lima de Souza', veiculo: 'Audi Q5 Quattro', placa: 'GTR4X44',
    titulo: 'Revisão de 40.000km + Freios',
    descricao: 'Revisão programada acompanhada de substituição do conjunto de pastilhas e discos de freio dianteiros, com checagem do sistema ABS.',
    status: 'em_andamento', mecanico: 'André S.',
  },
  {
    offsetDias: 0, horaInicio: '14:00', horaFim: '15:30',
    cliente: 'Roberto Mendes Albuquerque', veiculo: 'Volvo XC60', placa: 'VOL6V60',
    titulo: 'Troca de óleo e filtros',
    descricao: 'Troca de óleo sintético 5W30, filtro de óleo, filtro de ar e filtro de cabine. Veículo concluído antes do previsto.',
    status: 'pronto_retirada', mecanico: 'André S.',
  },
  {
    offsetDias: 0, horaInicio: '16:00', horaFim: '17:00',
    cliente: 'Mariana Costa Ribeiro', veiculo: 'Honda Civic Touring', placa: 'HCV9B12',
    titulo: 'Alinhamento e balanceamento',
    descricao: 'Alinhamento de direção 3D e balanceamento das 4 rodas. Cliente relatou trepidação leve no volante em velocidades acima de 80km/h.',
    status: 'aguardando_pagamento', mecanico: 'Ricardo',
  },

  // ── Ontem ─────────────────────────────────────────────────────────────────
  {
    offsetDias: -1, horaInicio: '09:00', horaFim: '11:00',
    cliente: 'Bruno Alves Teixeira', veiculo: 'Ford Ranger XLT', placa: 'RNG7M12',
    titulo: 'Suspensão dianteira',
    descricao: 'Substituição de amortecedores dianteiros e batente de suspensão. Teste de rodagem realizado sem ruídos remanescentes.',
    status: 'concluido', mecanico: 'André S.',
  },
  {
    offsetDias: -1, horaInicio: '15:00', horaFim: '16:00',
    cliente: 'Renata Pires Nogueira', veiculo: 'Volkswagen Golf GTI', placa: 'VWG3F56',
    titulo: 'Diagnóstico de ar-condicionado',
    descricao: 'Cliente relatou ar-condicionado sem gelar. Agendamento cancelado a pedido do cliente, será remarcado.',
    status: 'cancelado',
  },

  // ── Amanhã ────────────────────────────────────────────────────────────────
  {
    offsetDias: 1, horaInicio: '09:00', horaFim: '10:00',
    cliente: 'Ana Paula Ferreira', veiculo: 'Toyota Corolla XEi', placa: 'COR4X21',
    titulo: 'Troca de pastilhas de freio',
    descricao: 'Substituição das pastilhas de freio traseiras e verificação do nível de fluido de freio.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 1, horaInicio: '11:00', horaFim: '12:30',
    cliente: 'Pedro Henrique Souza', veiculo: 'Jeep Compass Longitude', placa: 'JPC8H45',
    titulo: 'Diagnóstico elétrico',
    descricao: 'Painel apresentando luz de injeção intermitente. Necessário escaneamento da central eletrônica e teste de sensores.',
    status: 'agendado', mecanico: 'André S.',
  },

  // ── Depois de amanhã ──────────────────────────────────────────────────────
  {
    offsetDias: 2, horaInicio: '08:30', horaFim: '10:00',
    cliente: 'Juliana Martins Azevedo', veiculo: 'Fiat Toro Volcano', placa: 'TOR2D90',
    titulo: 'Revisão geral de 20.000km',
    descricao: 'Revisão programada de 20.000km, incluindo troca de óleo, filtros, verificação de níveis de fluido e checklist completo de segurança.',
    status: 'agendado', mecanico: 'Ricardo',
    reagendadoDe: { offsetDias: -3, horaInicio: '08:30' },
  },
  {
    offsetDias: 2, horaInicio: '14:00', horaFim: '15:00',
    cliente: 'Marcos Vinícius Pereira', veiculo: 'Chevrolet Onix Premier', placa: 'ONX5K77',
    titulo: 'Troca de óleo',
    descricao: 'Troca de óleo e filtro de óleo conforme plano de manutenção do veículo.',
    status: 'concluido', mecanico: 'André S.',
  },

  // ── Restante da semana ────────────────────────────────────────────────────
  {
    offsetDias: 3, horaInicio: '10:00', horaFim: '11:00',
    cliente: 'Camila Rodrigues Lima', veiculo: 'Hyundai HB20 Comfort', placa: 'HBR1A33',
    titulo: 'Troca de correia dentada',
    descricao: 'Substituição preventiva da correia dentada e tensor, conforme indicação da quilometragem do veículo.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 3, horaInicio: '13:30', horaFim: '14:30',
    cliente: 'Felipe Augusto Ramos', veiculo: 'Renault Duster Iconic', placa: 'DUS7N21',
    titulo: 'Revisão de freios',
    descricao: 'Inspeção do sistema de freios dianteiro e traseiro, com medição da espessura das pastilhas e discos.',
    status: 'agendado', mecanico: 'André S.',
  },
  {
    offsetDias: 4, horaInicio: '09:00', horaFim: '10:30',
    cliente: 'Larissa Gomes Cardoso', veiculo: 'Jeep Renegade Sport', placa: 'RNG4S18',
    titulo: 'Higienização do ar-condicionado',
    descricao: 'Higienização completa do sistema de ar-condicionado e troca do filtro de cabine.',
    status: 'agendado', mecanico: 'Ricardo',
  },

  // ── Semana que vem ────────────────────────────────────────────────────────
  {
    offsetDias: 7, horaInicio: '08:00', horaFim: '09:00',
    cliente: 'Diego Santos Moraes', veiculo: 'Renault Kwid Intense', placa: 'KWD9L02',
    titulo: 'Troca de óleo e filtros',
    descricao: 'Troca de óleo, filtro de óleo e filtro de ar conforme plano de revisões.',
    status: 'agendado', mecanico: 'André S.',
  },
  {
    offsetDias: 7, horaInicio: '10:30', horaFim: '12:00',
    cliente: 'Beatriz Lima Fontes', veiculo: 'Nissan Kicks SV', placa: 'NSK4P88',
    titulo: 'Diagnóstico de suspensão',
    descricao: 'Cliente relata ruído na suspensão traseira em lombadas. Necessária inspeção de buchas e amortecedores.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 8, horaInicio: '13:00', horaFim: '14:00',
    cliente: 'Thiago Carvalho Nunes', veiculo: 'Peugeot 208 Griffe', placa: 'PEU6R34',
    titulo: 'Alinhamento e balanceamento',
    descricao: 'Alinhamento e balanceamento após troca de pneus dianteiros.',
    status: 'agendado', mecanico: 'André S.',
  },
  {
    offsetDias: 9, horaInicio: '08:30', horaFim: '09:30',
    cliente: 'Patrícia Gonçalves Tavares', veiculo: 'Toyota Hilux SRX', placa: 'HLX2M70',
    titulo: 'Revisão de 60.000km',
    descricao: 'Revisão programada de 60.000km com troca de óleo do motor, óleo de câmbio e checklist completo.',
    status: 'agendado', mecanico: 'Ricardo',
  },

  // ── Início do mês (datas passadas, para histórico do mês) ────────────────
  {
    offsetDias: -10, horaInicio: '09:00', horaFim: '10:00',
    cliente: 'Eduardo Lopes Barros', veiculo: 'Chevrolet Tracker Premier', placa: 'TRK8B41',
    titulo: 'Troca de óleo',
    descricao: 'Troca de óleo e filtro, conforme intervalo recomendado pelo fabricante.',
    status: 'concluido', mecanico: 'André S.',
  },
  {
    offsetDias: -9, horaInicio: '11:00', horaFim: '12:30',
    cliente: 'Vanessa Almeida Castro', veiculo: 'Honda HR-V EXL', placa: 'HRV5C29',
    titulo: 'Revisão de 30.000km',
    descricao: 'Revisão programada de 30.000km com troca de óleo, filtros e checklist completo de segurança.',
    status: 'concluido', mecanico: 'Ricardo',
  },
  {
    offsetDias: -8, horaInicio: '14:00', horaFim: '15:00',
    cliente: 'Gustavo Henrique Dias', veiculo: 'Fiat Pulse Drive', placa: 'PLS3D67',
    titulo: 'Troca de pneus',
    descricao: 'Substituição dos 4 pneus por modelo equivalente, com balanceamento e alinhamento inclusos.',
    status: 'concluido', mecanico: 'André S.',
  },
  {
    offsetDias: -5, horaInicio: '08:00', horaFim: '09:00',
    cliente: 'Letícia Fernandes Rocha', veiculo: 'Hyundai Creta Platinum', placa: 'CRT1F95',
    titulo: 'Diagnóstico de motor',
    descricao: 'Cliente relata perda de potência em subidas. Necessário diagnóstico de injeção eletrônica.',
    status: 'concluido', mecanico: 'Ricardo',
  },
  {
    offsetDias: -4, horaInicio: '10:00', horaFim: '11:30',
    cliente: 'Rodrigo Mendes Cunha', veiculo: 'Volkswagen T-Cross Highline', placa: 'TCR9M53',
    titulo: 'Revisão de 10.000km',
    descricao: 'Primeira revisão programada do veículo, conforme manual de garantia do fabricante.',
    status: 'concluido', mecanico: 'André S.',
  },

  // ── Mais adiante no mês ───────────────────────────────────────────────────
  {
    offsetDias: 13, horaInicio: '09:00', horaFim: '10:00',
    cliente: 'Isabela Martins Pereira', veiculo: 'Toyota Yaris XLS', placa: 'YRS6P22',
    titulo: 'Troca de bateria',
    descricao: 'Substituição da bateria do veículo, com teste do sistema de carga e alternador.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 15, horaInicio: '14:30', horaFim: '16:00',
    cliente: 'Lucas Gabriel Farias', veiculo: 'Jeep Compass Trailhawk', placa: 'CPS7T84',
    titulo: 'Revisão de 50.000km',
    descricao: 'Revisão programada de 50.000km com troca de óleo, filtros, velas e checklist completo.',
    status: 'agendado', mecanico: 'André S.',
  },
  {
    offsetDias: 18, horaInicio: '08:00', horaFim: '09:30',
    cliente: 'Amanda Cristina Souza', veiculo: 'Chevrolet Onix Plus LTZ', placa: 'ONP4L19',
    titulo: 'Alinhamento e balanceamento',
    descricao: 'Alinhamento e balanceamento de rotina solicitado pelo cliente.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 21, horaInicio: '10:00', horaFim: '12:00',
    cliente: 'Rafael Costa Monteiro', veiculo: 'Ford Bronco Sport', placa: 'BCS2S60',
    titulo: 'Revisão de freios e suspensão',
    descricao: 'Inspeção completa do sistema de freios e suspensão antes de viagem de longa distância.',
    status: 'agendado', mecanico: 'André S.',
  },

  // ── Próximo mês (para navegação) ─────────────────────────────────────────
  {
    offsetDias: 28, horaInicio: '09:00', horaFim: '10:00',
    cliente: 'Tatiane Borges Almeida', veiculo: 'Hyundai Tucson Limited', placa: 'TCS9B36',
    titulo: 'Revisão de 80.000km',
    descricao: 'Revisão programada de 80.000km, com troca de correia dentada, óleo e filtros.',
    status: 'agendado', mecanico: 'Ricardo',
  },
  {
    offsetDias: 32, horaInicio: '11:00', horaFim: '12:00',
    cliente: 'Henrique Oliveira Sá', veiculo: 'Nissan Versa Advance', placa: 'VRS3A75',
    titulo: 'Troca de óleo e filtros',
    descricao: 'Troca de óleo, filtro de óleo e filtro de ar conforme plano de revisões.',
    status: 'agendado', mecanico: 'André S.',
  },

  // ── Mês anterior (para navegação) ────────────────────────────────────────
  {
    offsetDias: -25, horaInicio: '09:00', horaFim: '10:30',
    cliente: 'Caroline Ribeiro Duarte', veiculo: 'Toyota Corolla Cross XRE', placa: 'CRX8D14',
    titulo: 'Revisão de 20.000km',
    descricao: 'Revisão programada de 20.000km com troca de óleo, filtros e checklist completo.',
    status: 'concluido', mecanico: 'Ricardo',
  },
  {
    offsetDias: -22, horaInicio: '14:00', horaFim: '15:00',
    cliente: 'Mateus Henrique Lopes', veiculo: 'Fiat Argo Trekking', placa: 'ARG5T48',
    titulo: 'Troca de amortecedores',
    descricao: 'Substituição dos amortecedores traseiros, com verificação dos coxins.',
    status: 'cancelado',
  },
];

function buildSeed(): Agendamento[] {
  const today = new Date();
  return SEED_TEMPLATES.map((tpl, idx) => {
    const data = toISODate(addDays(today, tpl.offsetDias));
    const reagendamento: AppointmentReschedule | undefined = tpl.reagendadoDe
      ? {
          dataAnterior: toISODate(addDays(today, tpl.reagendadoDe.offsetDias)),
          horaAnterior: tpl.reagendadoDe.horaInicio,
          novaData: data,
          novaHora: tpl.horaInicio,
        }
      : undefined;

    return {
      id: `seed-${idx + 1}`,
      cliente: tpl.cliente,
      veiculo: tpl.veiculo,
      placa: tpl.placa,
      data,
      horaInicio: tpl.horaInicio,
      horaFim: tpl.horaFim,
      titulo: tpl.titulo,
      descricao: tpl.descricao,
      status: tpl.status,
      mecanico: tpl.mecanico,
      reagendamento,
    } satisfies Agendamento;
  });
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
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(() => buildSeed());
  const [loading, setLoading] = useState(true);
  const [usingApi, setUsingApi] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listarAgendamentos();
      if (Array.isArray(data) && data.length > 0) {
        setAgendamentos(sortAgendamentos(data));
        setUsingApi(true);
      } else {
        setAgendamentos(sortAgendamentos(buildSeed()));
        setUsingApi(false);
      }
    } catch {
      setAgendamentos(sortAgendamentos(buildSeed()));
      setUsingApi(false);
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
    setAgendamentos(prev => sortAgendamentos([...prev, novo]));

    if (usingApi) {
      try {
        const saved = await api.criarAgendamento(novo);
        if (saved?.id) {
          setAgendamentos(prev => sortAgendamentos(prev.map(a => (a.id === novo.id ? { ...novo, ...saved } : a))));
        }
      } catch {
        // mantém o registro local mesmo se a sincronização falhar
      }
    }
    return novo;
  }, [usingApi]);

  const updateAgendamento = useCallback(async (id: string, changes: Partial<Agendamento>) => {
    setAgendamentos(prev =>
      sortAgendamentos(
        prev.map(a => (a.id === id ? { ...a, ...changes, updatedAt: new Date().toISOString() } : a))
      )
    );
    if (usingApi) {
      try { await api.atualizarAgendamento(id, changes); } catch { /* best-effort */ }
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
              horaFim: minutesToTime(timeToMinutes(novaHora) + duracao),
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

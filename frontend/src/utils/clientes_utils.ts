// ── Clientes: utilitários e cruzamento de dados ────────────────
// A tela de Clientes não duplica dados de Veículos/Agendamentos/Ordens — ela
// os CRUZA: veículos pelo `clienteId` do proprietário (vínculo real no banco);
// agendamentos e ordens ainda por nome (`Agendamento.cliente` é texto). `enrichClientes` é o ponto
// único onde esse cruzamento acontece; o restante da tela consome apenas o
// resultado já combinado (`ClienteComDados`).

import type {
  Cliente,
  ClienteComDados,
  ClienteFiltros,
  ClienteStatus,
} from '../types/cliente';
import type { VeiculoCadastrado } from '../types/veiculo';
import type { Agendamento } from '../types/agendamento';
import type { OrdemRow } from '../types/dashboard';
import { toISODate } from './agenda';

// ── Normalização / cruzamento por nome ────────────────────────────────────────

/** Remove acentos, espaços extras e caixa — usado para comparar nomes entre
 *  Cliente, VeiculoProprietario e Agendamento.cliente com tolerância a
 *  pequenas diferenças de digitação/acentuação. */
export function normalizeName(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// ── Filtros ───────────────────────────────────────────────────────────────────

export function emptyFiltros(): ClienteFiltros {
  return { status: 'todos', semVeiculos: false };
}

export function filtrosAtivos(f: ClienteFiltros): boolean {
  return f.status !== 'todos' || f.semVeiculos;
}

// ── Status derivado ────────────────────────────────────────────────────────────
// Prioridade (do mais urgente/operacional para o mais neutro): um cliente com
// veículo na oficina agora é mais relevante que um com apenas um agendamento
// futuro, por exemplo. Segue a mesma linguagem de status já usada em
// VeiculoStatus/AppointmentStatus, sem introduzir estados novos no restante
// do sistema.

function computeClienteStatus(
  veiculosDoCliente: VeiculoCadastrado[],
  agendamentosDoCliente: Agendamento[],
  proximoAgendamento: Agendamento | null,
): ClienteStatus {
  if (veiculosDoCliente.some(v => v.status === 'na_oficina')) return 'em_atendimento';
  if (
    veiculosDoCliente.some(v => v.status === 'pronto_entrega') ||
    agendamentosDoCliente.some(a => a.status === 'pronto_retirada')
  ) return 'pronto_retirada';
  if (veiculosDoCliente.some(v => v.status === 'aguardando_aprovacao')) return 'aguardando_aprovacao';
  if (agendamentosDoCliente.some(a => a.status === 'aguardando_pagamento')) return 'pagamento_pendente';
  if (proximoAgendamento) return 'agendado';
  return 'disponivel';
}

// ── Enriquecimento (cruzamento com Veículos / Agendamentos / Ordens) ─────────

export function enrichClientes(
  clientes: Cliente[],
  veiculos: VeiculoCadastrado[],
  agendamentos: Agendamento[],
  ordens: OrdemRow[],
): ClienteComDados[] {
  const todayISO = toISODate(new Date());

  return clientes.map(c => {
    const alvo = normalizeName(c.nome);

    // Veículo vinculado a um cliente carrega o `clienteId`: casa por id (dois clientes com o mesmo nome não
    // se misturam). Sem id (proprietário só em texto), cai no nome.
    const veiculosDoCliente = veiculos.filter(v => {
      if (!v.proprietario) return false;
      if (v.proprietario.clienteId) return v.proprietario.clienteId === c.id;
      return normalizeName(v.proprietario.nome) === alvo;
    });
    const agendamentosDoCliente = agendamentos.filter(a => normalizeName(a.cliente) === alvo);
    const ordensDoCliente = ordens.filter(o => normalizeName(o.cliente) === alvo);

    const futuros = agendamentosDoCliente
      .filter(a => a.data >= todayISO && a.status !== 'cancelado' && a.status !== 'concluido')
      .sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio));

    const futurosIds = new Set(futuros.map(a => a.id));
    const passados = agendamentosDoCliente
      .filter(a => !futurosIds.has(a.id))
      .sort((a, b) => (b.data + b.horaInicio).localeCompare(a.data + a.horaInicio));

    const proximoAgendamento = futuros[0] ?? null;

    const datasVisita: string[] = [
      ...agendamentosDoCliente.filter(a => a.data <= todayISO && a.status !== 'cancelado').map(a => a.data),
      ...ordensDoCliente.map(o => (o.created_at || '').slice(0, 10)).filter(Boolean),
    ];
    const ultimaVisita = datasVisita.length > 0 ? datasVisita.sort()[datasVisita.length - 1] : null;

    const status = computeClienteStatus(veiculosDoCliente, agendamentosDoCliente, proximoAgendamento);

    return {
      ...c,
      veiculos: veiculosDoCliente,
      veiculoPrincipal: veiculosDoCliente[0] ?? null,
      ultimaVisita,
      proximoAgendamento,
      agendamentosFuturos: futuros,
      agendamentosPassados: passados,
      ordens: ordensDoCliente,
      status,
    };
  });
}

// ── Indicadores (cards de resumo) ─────────────────────────────────────────────

export interface ClienteStats {
  total: number;
  emAtendimento: number;
  aguardandoAprovacao: number;
  pagamentoPendente: number;
  prontoRetirada: number;
}

export function computeClienteStats(lista: ClienteComDados[]): ClienteStats {
  return {
    total: lista.length,
    emAtendimento: lista.filter(c => c.status === 'em_atendimento').length,
    aguardandoAprovacao: lista.filter(c => c.status === 'aguardando_aprovacao').length,
    pagamentoPendente: lista.filter(c => c.status === 'pagamento_pendente').length,
    prontoRetirada: lista.filter(c => c.status === 'pronto_retirada').length,
  };
}

// ── Formatadores ───────────────────────────────────────────────────────────────

/** Ex.: "15/07 às 14h" ou "15/07 às 14h30" — usado na badge dinâmica do card. */
export function formatAgendadoBadge(ag: Agendamento): string {
  const [, m, d] = ag.data.split('-');
  const [hh, mm] = ag.horaInicio.split(':');
  const hora = mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
  return `${d}/${m} às ${hora}`;
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Ex.: "cliente desde jan/2024" — usado na linha de informações rápidas do card. */
export function formatMesAno(iso: string): string {
  const d = new Date(iso);
  return `${MESES_ABREV[d.getMonth()]}/${d.getFullYear()}`;
}

export function formatDataCurta(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatTelefone(tel?: string): string {
  return tel?.trim() || '—';
}

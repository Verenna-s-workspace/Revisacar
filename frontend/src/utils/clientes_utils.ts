// ── Clientes: utilitários, cruzamento de dados e demonstração ────────────────
// A tela de Clientes não duplica dados de Veículos/Agendamentos/Ordens — ela
// os CRUZA por nome (mesmo padrão de vínculo já usado em `VeiculoProprietario`
// e `Agendamento.cliente`, ambos texto livre hoje). `enrichClientes` é o ponto
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

    const veiculosDoCliente = veiculos.filter(
      v => !!v.proprietario && normalizeName(v.proprietario.nome) === alvo,
    );
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

// ── Dados de demonstração ─────────────────────────────────────────────────────
// Fallback enquanto o endpoint `/clientes` não estiver disponível no backend
// (mesmo padrão adotado em `useVeiculos`/`useAgendamentos`). Os nomes abaixo
// foram escolhidos deliberadamente para coincidir com proprietários já
// existentes em `buildSeedVeiculos()` e com clientes de `useAgendamentos`,
// para que o cruzamento por nome produza um catálogo coerente mesmo quando
// as três telas estão rodando 100% em dados de demonstração.

interface SeedClienteTemplate {
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  diasAtras: number;
}

const SEED_CLIENTE_TEMPLATES: SeedClienteTemplate[] = [
  // ── Presentes em Veículos E Agendamentos (catálogo totalmente cruzado) ──
  { nome: 'Carlos Eduardo Oliveira', cpfCnpj: '234.567.890-11', telefone: '(11) 98765-1234', email: 'carlos.eduardo@email.com', endereco: 'Rua das Palmeiras, 452 — São Paulo/SP', diasAtras: 520 },
  { nome: 'Roberto Mendes Albuquerque', cpfCnpj: '456.789.012-33', telefone: '(21) 96543-2109', email: 'roberto.mendes@email.com', endereco: 'Av. Atlântica, 1200 — Rio de Janeiro/RJ', diasAtras: 410 },
  { nome: 'Mariana Costa Ribeiro', cpfCnpj: '567.890.123-44', telefone: '(11) 95432-1098', email: 'mariana.costa@email.com', endereco: 'Rua Augusta, 890 — São Paulo/SP', diasAtras: 95 },
  { nome: 'Bruno Alves Teixeira', cpfCnpj: '678.901.234-55', telefone: '(31) 94321-0987', email: 'bruno.teixeira@email.com', endereco: 'Av. Afonso Pena, 330 — Belo Horizonte/MG', diasAtras: 730 },
  { nome: 'Ana Paula Ferreira', cpfCnpj: '789.012.345-66', telefone: '(11) 93210-9876', email: 'ana.ferreira@email.com', endereco: 'Rua Oscar Freire, 210 — São Paulo/SP', diasAtras: 280 },
  { nome: 'Pedro Henrique Souza', cpfCnpj: '890.123.456-77', telefone: '(21) 92109-8765', email: 'pedro.henrique@email.com', endereco: 'Rua Voluntários da Pátria, 77 — Rio de Janeiro/RJ', diasAtras: 150 },
  { nome: 'Diego Santos Moraes', cpfCnpj: '901.234.567-88', telefone: '(11) 99001-2233', email: 'diego.moraes@email.com', diasAtras: 365 },
  { nome: 'Beatriz Lima Fontes', cpfCnpj: '012.345.678-99', telefone: '(11) 91098-7654', email: 'beatriz.lima@email.com', endereco: 'Alameda Santos, 1500 — São Paulo/SP', diasAtras: 40 },
  { nome: 'Marcos Vinícius Pereira', cpfCnpj: '111.222.333-44', telefone: '(11) 98877-6655', email: 'marcos.vinicius@email.com', diasAtras: 130 },

  // ── Presentes apenas em Veículos (cadastro sem agendamento futuro) ──────
  { nome: 'Lucas Andrelo da Silva', cpfCnpj: '123.456.789-00', telefone: '(11) 99876-5432', email: 'lucas.andrelo@email.com', endereco: 'Rua Vergueiro, 3400 — São Paulo/SP', diasAtras: 340 },
  { nome: 'Maria Siqueira Bastos', cpfCnpj: '345.678.901-22', telefone: '(19) 97654-3210', email: 'maria.siqueira@email.com', endereco: 'Rua Barão de Jaguara, 88 — Campinas/SP', diasAtras: 180 },

  // ── Presentes apenas em Agendamentos (contato recente, veículo ainda não
  //    formalizado na frota) ───────────────────────────────────────────────
  { nome: 'Fernanda Lima de Souza', cpfCnpj: '222.333.444-55', telefone: '(11) 97788-2211', email: 'fernanda.souza@email.com', diasAtras: 20 },
  { nome: 'Juliana Martins Azevedo', cpfCnpj: '333.444.555-66', telefone: '(11) 96677-3322', email: 'juliana.azevedo@email.com', diasAtras: 12 },
  { nome: 'Patrícia Gonçalves Tavares', cpfCnpj: '444.555.666-77', telefone: '(19) 95566-4433', email: 'patricia.tavares@email.com', diasAtras: 8 },

  // ── Prospects novos, sem nenhum veículo ou agendamento vinculado ───────
  { nome: 'Fernando Augusto Melo', telefone: '(11) 94455-6677', email: 'fernando.melo@email.com', diasAtras: 3 },
  { nome: 'Juliana Prado Martins', telefone: '(11) 93344-5566', diasAtras: 1 },
];

function buildSeedCliente(tpl: SeedClienteTemplate, idx: number): Cliente {
  const created = new Date();
  created.setDate(created.getDate() - tpl.diasAtras);
  return {
    id: `cli-seed-${idx + 1}`,
    nome: tpl.nome,
    cpfCnpj: tpl.cpfCnpj,
    telefone: tpl.telefone,
    email: tpl.email,
    endereco: tpl.endereco,
    createdAt: created.toISOString(),
  };
}

export function buildSeedClientes(): Cliente[] {
  return SEED_CLIENTE_TEMPLATES.map(buildSeedCliente);
}

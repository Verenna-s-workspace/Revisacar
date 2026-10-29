// ── Dados da oficina (Configurações) ─────────────────────────────────────────
//
// Os dados da oficina (nome, CNPJ, telefone, e-mail, endereço, taxa de mão de
// obra e horário de funcionamento) vivem no blob 'oficina_config' do
// localStorage — o MESMO que a tela de Configurações lê e grava e que
// utils/horario_funcionamento.ts usa pra ler o horário.
//
// Este módulo existe pro cadastro (etapa 2: "Cadastre as informações da sua
// oficina") gravar no mesmo lugar sem reimplementar o parsing. A tela de
// Configurações continua dona da edição depois do cadastro.
//
// Desde a migração 0005 a fonte é o servidor (GET/PUT /oficina/config); o
// localStorage virou a cópia local que a Agenda lê (sincronizarOficinaConfig).

import { notificarHorarioAtualizado } from './horario_funcionamento';
import { api } from './api';

const STORAGE_KEY = 'oficina_config';

/** Mesmos campos e nomes que ConfiguracoesPage grava. */
export interface OficinaConfig {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  /** Taxa de mão de obra, em R$/hora. */
  valorHora: number;
  /** 'HH:MM' */
  horaAbertura: string;
  /** 'HH:MM' */
  horaFechamento: string;
}

/** O que o formulário da etapa 2 coleta, ainda como texto digitado. */
export interface OficinaFormValues {
  nome: string;
  telefone: string;
  endereco: string;
  /** String decimal crua do <Input type="currency">, ex.: "120.00". */
  valorHora: string;
  horaAbertura: string;
  horaFechamento: string;
}

export type OficinaFormErrors = Partial<Record<keyof OficinaFormValues, string>>;

/** Fechamento precisa ser depois da abertura (mesma regra de Configurações).
 * 'HH:MM' compara certo como texto. */
export function horarioValido(abertura: string, fechamento: string): boolean {
  return /^\d{2}:\d{2}$/.test(abertura) && /^\d{2}:\d{2}$/.test(fechamento) && fechamento > abertura;
}

/** Valida o formulário da etapa 2. Devolve só os campos com problema — objeto
 * vazio = pode salvar. */
export function validarOficinaForm(v: OficinaFormValues): OficinaFormErrors {
  const erros: OficinaFormErrors = {};

  if (v.nome.trim().length < 2) erros.nome = 'Informe o nome da oficina';

  const telDigitos = v.telefone.replace(/\D/g, '');
  if (telDigitos.length < 10) erros.telefone = 'Informe o telefone com DDD';

  if (v.endereco.trim().length < 5) erros.endereco = 'Informe o endereço da oficina';

  const valor = Number(v.valorHora);
  if (!v.valorHora || Number.isNaN(valor) || valor <= 0) erros.valorHora = 'Informe a taxa de mão de obra';

  if (!v.horaAbertura) erros.horaAbertura = 'Informe a abertura';
  if (!v.horaFechamento) erros.horaFechamento = 'Informe o fechamento';
  if (!erros.horaAbertura && !erros.horaFechamento && !horarioValido(v.horaAbertura, v.horaFechamento)) {
    erros.horaFechamento = 'Deve ser depois do horário de abertura';
  }

  return erros;
}

/** Grava os dados da oficina no localStorage, mesclando com o que já existir
 * (campos desconhecidos que Configurações venha a ter são preservados) e
 * avisando as telas de Agendamento já montadas sobre o horário novo.
 *
 * Lança erro se o navegador recusar a gravação (modo privado cheio etc.), pra
 * o formulário avisar em vez de seguir como se tivesse salvo. */
export function salvarOficinaConfig(config: OficinaConfig): void {
  let atual: Record<string, unknown> = {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') atual = parsed as Record<string, unknown>;
    }
  } catch {
    // JSON corrompido — começa limpo.
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...atual, ...config }));
  notificarHorarioAtualizado();
}

/** Dono edita sempre; funcionário, se o cargo tiver configuracoes.editar (o servidor confere de novo). */
export function podeEditarConfiguracoes(user: { tipo?: string; permissoes?: string[] } | null | undefined): boolean {
  if (!user) return false;
  return user.tipo !== 'funcionario' || !!user.permissoes?.includes('configuracoes.editar');
}

/** O que GET/PUT /oficina/config devolve. `salvo` false = a oficina ainda não salvou nada no servidor. */
export interface OficinaConfigServidor extends OficinaConfig {
  salvo: boolean;
  atualizadoEm?: string | null;
}

function lerCopiaLocal(): Partial<OficinaConfig> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Traz os dados da oficina do servidor para a cópia local (a Agenda lê o horário dela). Se o
 * servidor ainda não tem nada e este navegador tem dados de antes da 0005, sobe-os uma vez —
 * só quem pode editar Configurações. Falha de rede devolve null e a cópia local fica como está. */
export async function sincronizarOficinaConfig(podeEditar: boolean): Promise<OficinaConfigServidor | null> {
  let servidor: OficinaConfigServidor;
  try {
    servidor = await api.obterConfigOficina();
  } catch {
    return null;
  }
  const local = lerCopiaLocal();
  if (!servidor.salvo && podeEditar && local?.nome && local.horaAbertura && local.horaFechamento) {
    try {
      const { cnpj: _cnpj, ...dados } = { ...servidor, ...local };
      servidor = await api.salvarConfigOficina(dados);
    } catch {
      return servidor;   // não conseguiu subir agora; tenta de novo na próxima abertura
    }
  }
  if (servidor.salvo) {
    try {
      const { nome, cnpj, telefone, email, endereco, valorHora, horaAbertura, horaFechamento } = servidor;
      salvarOficinaConfig({ nome, cnpj, telefone, email, endereco, valorHora, horaAbertura, horaFechamento });
    } catch {
      // localStorage cheio/bloqueado: a tela usa o que veio do servidor mesmo assim.
    }
  }
  return servidor;
}

// ── Regras dos campos dos checklists ──────────────────────────────────────────
// Fonte única dos limites e validações dos campos da OS (checklist de entrada, inspeção, encerramento).
// Duas camadas, sempre juntas:
//   1) FILTRO (masks.ts): o campo nem aceita o caractere inválido enquanto digita/cola;
//   2) validadores daqui: conferem o formato do valor pronto (mostrados ao sair do campo e ao avançar).
// O backend repete as mesmas regras em backend/orders/campos_os.py — ao mudar uma, mude a outra.
// Todo validador devolve `undefined` quando o valor é aceitável OU vazio: "obrigatório" é outra
// regra (validateStep1 / handleExport) — campo opcional vazio nunca acusa erro.

import {
  FILTRO, NOME_MAX, KM_MAX_DIGITOS, onlyDigits, limparTexto,
  formatNome, formatPlaca, formatChassi,
  isValidCpfCnpj, isValidPlaca, isValidEmail,
} from '../components/inputs/masks';
import type { OSHeader, Cliente, Veiculo, Tecnico, ValidationErrors } from '../types';
import type { OSPrefillInput } from '../types/atendimento';

/** Limites de tamanho (caracteres). */
export const LIM = {
  osNum: 10,
  nome: NOME_MAX,
  email: 120,
  modelo: 60,
  cor: 30,
  obsLonga: 1000,      // observações de entrada, relato do cliente
  obsItem: 500,        // observação técnica de um item do checklist
  itemAdicional: 60,   // nome de item adicionado à mão
  maxItensAdicionais: 50,
  registro: 20,
  parecer: 2000,
  peca: 80,
  pecaModelo: 60,
  pecaMarca: 60,
  pecaCodigo: 40,
  pecaQtdDigitos: 3,   // até 999 unidades
  maxPecas: 100,
  relatorioCopia: 10000,
} as const;

export const ANO_MIN = 1900;
export const DATA_MIN = '2000-01-01';

// ── Padrões ───────────────────────────────────────────────────────────────────

/** Telefone BR só com dígitos: DDD (11–99) + celular (9 + 8 dígitos) ou fixo (8 dígitos, não começa com 0/1). */
export const TEL_RE = /^[1-9][1-9](?:9\d{8}|[2-9]\d{7})$/;
export const CHASSI_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
export const OS_NUM_RE = /^\d{1,10}$/;

// ── Hoje (local) ──────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
export const hojeISO = (d: Date = new Date()): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ── Validadores ───────────────────────────────────────────────────────────────

export function validarOsNum(v: string): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  return OS_NUM_RE.test(t) ? undefined : `Use só números (até ${LIM.osNum} dígitos)`;
}

export function validarKm(v: string): string | undefined {
  const d = onlyDigits(v);
  if (!d) return undefined;
  return d.length <= KM_MAX_DIGITOS ? undefined : 'Quilometragem alta demais: confira os números digitados';
}

export function validarNome(v: string): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  if (t.replace(/[^\p{L}]/gu, '').length < 2) return 'Nome muito curto';
  return undefined;
}

export function validarDoc(v: string): string | undefined {
  const d = onlyDigits(v);
  if (!d) return undefined;
  if (d.length !== 11 && d.length !== 14) return 'CPF tem 11 dígitos e CNPJ tem 14';
  return isValidCpfCnpj(d) ? undefined : 'CPF/CNPJ inválido: confira os números digitados';
}

export function validarTel(v: string): string | undefined {
  const d = onlyDigits(v);
  if (!d) return undefined;
  return TEL_RE.test(d) ? undefined : 'Telefone inválido — use DDD + número';
}

export function validarEmail(v: string): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  if (t.length > LIM.email) return `E-mail com no máximo ${LIM.email} caracteres`;
  return isValidEmail(t) ? undefined : 'E-mail inválido: use o formato nome@exemplo.com';
}

export function validarPlaca(v: string): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  return isValidPlaca(t) ? undefined : 'Placa inválida (ABC1D23 ou ABC1234)';
}

export function validarAno(v: string, hoje: Date = new Date()): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  if (!/^\d{4}$/.test(t)) return 'Ano com 4 dígitos';
  const max = hoje.getFullYear() + 1;
  const n = Number(t);
  return n >= ANO_MIN && n <= max ? undefined : `Ano entre ${ANO_MIN} e ${max}`;
}

export function validarChassi(v: string): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  return CHASSI_RE.test(t) ? undefined : 'Chassi com 17 caracteres (sem I, O, Q)';
}

/** Data AAAA-MM-DD real, de 2000 até hoje. */
export function validarData(v: string, hoje: string = hojeISO()): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'Data inválida: confira dia, mês e ano';
  const [y, m, d] = t.split('-').map(Number);
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return 'Data inválida: confira dia, mês e ano';
  if (t < DATA_MIN) return 'Data muito antiga';
  if (t > hoje) return 'Data no futuro';
  return undefined;
}

/** Registro profissional: letras, números, espaço, ponto, barra e hífen (até 20). */
export function validarRegistro(v: string): string | undefined {
  const t = (v ?? '').trim();
  if (!t) return undefined;
  return !/[^A-Za-z0-9 ./\-]/.test(t) && t.length <= LIM.registro ? undefined : 'Registro inválido: use só letras, números, espaço, ponto, barra e hífen';
}

// ── Validação por bloco do formulário ─────────────────────────────────────────
// Formato de todos os campos preenchidos (campo vazio passa). As chaves são as mesmas de
// `validateStep1`/`validateStep5` (utils/index.ts), que somam isto às regras de "obrigatório"
// — a tela liga cada mensagem ao seu campo.

const montar = (pares: [string, string | undefined][]): ValidationErrors => {
  const e: ValidationErrors = {};
  for (const [chave, msg] of pares) if (msg) e[chave] = msg;
  return e;
};

/** Etapa 1 — cabeçalho da OS, cliente e veículo. */
export function validarFormatosEntrada(osHeader: OSHeader, cliente: Cliente, veiculo: Veiculo): ValidationErrors {
  return montar([
    ['os_num', validarOsNum(osHeader.os_num)],
    ['os_date', validarData(osHeader.os_date)],
    ['os_km', validarKm(osHeader.os_km)],
    ['cli_nome', validarNome(cliente.nome)],
    ['cli_doc', validarDoc(cliente.doc)],
    ['cli_tel', validarTel(cliente.tel)],
    ['cli_email', validarEmail(cliente.email)],
    ['vei_placa', validarPlaca(veiculo.placa)],
    ['vei_ano', validarAno(veiculo.ano)],
    ['vei_chassi', validarChassi(veiculo.chassi)],
  ]);
}

/** Encerramento — dados do técnico (a saída não pode ser anterior à entrada). */
export function validarFormatosTecnico(osHeader: OSHeader, tecnico: Tecnico): ValidationErrors {
  const antes = tecnico.data_saida && osHeader.os_date && tecnico.data_saida < osHeader.os_date
    ? 'Anterior à data de entrada' : undefined;
  return montar([
    ['tec_nome', validarNome(tecnico.nome)],
    ['tec_registro', validarRegistro(tecnico.registro)],
    ['tec_km', validarKm(tecnico.km_saida)],
    ['tec_data', validarData(tecnico.data_saida) ?? antes],
  ]);
}

// ── Tabela de peças (inspeção) ────────────────────────────────────────────────

/** Limpa o valor de uma célula da tabela de peças conforme a coluna. Chamado pelo hook em todo update. */
export function sanitizarCampoPeca(campo: string, valor: string): string {
  switch (campo) {
    case 'peca':       return limparTexto(valor, FILTRO.item, LIM.peca);
    case 'modelo':     return limparTexto(valor, FILTRO.modelo, LIM.pecaModelo);
    case 'marca':      return limparTexto(valor, FILTRO.modelo, LIM.pecaMarca);
    case 'codigo':     return limparTexto(valor, FILTRO.codigo, LIM.pecaCodigo).toUpperCase();
    case 'quantidade': return onlyDigits(valor).replace(/^0+(?=\d)/, '').slice(0, LIM.pecaQtdDigitos);
    default:           return valor;
  }
}

/** Nome de item adicionado à mão no checklist. */
export const sanitizarItemAdicional = (v: string): string => limparTexto(v, FILTRO.item, LIM.itemAdicional);

// ── Pré-preenchimento ─────────────────────────────────────────────────────────

/**
 * Passa os dados que chegam de fora (veículo, cliente, agendamento) pelas MESMAS regras de digitação,
 * para o checklist nunca nascer com valor que o campo não aceitaria (telefone só com dígitos, nome sem
 * números, ano com 4 dígitos...). Quem compara o prefill com o estado do formulário usa a versão limpa.
 */
export function sanitizarPrefill(p: OSPrefillInput): OSPrefillInput {
  const ano = onlyDigits(p.veiculoAno ?? '').slice(0, 4);
  return {
    ...p,
    clienteNome: formatNome(p.clienteNome).trim(),
    clienteDoc: onlyDigits(p.clienteDoc ?? '').slice(0, 14) || undefined,
    clienteTel: onlyDigits(p.clienteTel ?? '').slice(0, 11) || undefined,
    clienteEmail: limparTexto(p.clienteEmail ?? '', FILTRO.espacos, LIM.email) || undefined,
    veiculoModelo: limparTexto(p.veiculoModelo, FILTRO.modelo, LIM.modelo).trim(),
    veiculoPlaca: formatPlaca(p.veiculoPlaca),
    veiculoAno: ano || undefined,
    veiculoCor: limparTexto(p.veiculoCor ?? '', FILTRO.cor, LIM.cor).trim() || undefined,
    veiculoChassi: formatChassi(p.veiculoChassi ?? '') || undefined,
  };
}

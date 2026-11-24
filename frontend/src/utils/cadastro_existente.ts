// ── Cadastros que já existem (sugestões do checklist) ─────────────────────────
// A tela só SUGERE; quem decide o que reaproveitar de verdade é o servidor, com as mesmas regras
// (backend/orders/cadastro_checklist.py). Mantenha a normalização igual à de lá.
//
// Sinal forte (o servidor reaproveita sozinho): CPF/CNPJ, e-mail, telefone + nome iguais.
// Sinal fraco (só vira sugestão, a pessoa confirma): telefone sozinho (família usa o mesmo número),
// nome parecido (existem homônimos).

import { formatPlaca, isValidPlaca, onlyDigits } from '../components/inputs/masks';
import type { Cliente as ClienteCarteira } from '../types/cliente';
import type { VeiculoCadastrado } from '../types/veiculo';

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** Nome comparável: sem acento, minúsculo, sem pontuação, sem "da/de/do/das/dos/e", espaços únicos. */
export function normalizarNome(valor: string): string {
  return (valor || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((p) => p && !PARTICULAS.has(p))
    .join(' ');
}

/** Telefone comparável: só dígitos, sem o 55 do país e com o 9 do celular. Inválido = ''. */
export function normalizarTelefone(valor: string): string {
  let d = onlyDigits(valor || '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 && '6789'.includes(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  return d.length === 10 || d.length === 11 ? d : '';
}

export type MotivoCliente = 'cpf' | 'email' | 'telefone_e_nome' | 'telefone' | 'nome';

export const ROTULO_MOTIVO: Record<MotivoCliente, string> = {
  cpf: 'mesmo CPF/CNPJ',
  email: 'mesmo e-mail',
  telefone_e_nome: 'mesmo nome e telefone',
  telefone: 'mesmo telefone',
  nome: 'nome parecido',
};

/** O servidor junta sozinho nestes casos; nos outros a pessoa precisa confirmar. */
export const MOTIVOS_FORTES: ReadonlySet<MotivoCliente> = new Set<MotivoCliente>(['cpf', 'email', 'telefone_e_nome']);

const PESO: Record<MotivoCliente, number> = { cpf: 100, email: 90, telefone_e_nome: 80, telefone: 50, nome: 30 };

export interface CandidatoCliente {
  cliente: ClienteCarteira;
  motivos: MotivoCliente[];
  qtdVeiculos: number;
}

interface DigitadoCliente { nome: string; doc: string; tel: string; email: string }

/** Todo termo digitado é começo de alguma palavra do nome ("joa sil" acha "João da Silva"). */
function nomeParecido(digitado: string, nomeCadastro: string): boolean {
  const termos = digitado.split(' ').filter(Boolean);
  const palavras = nomeCadastro.split(' ').filter(Boolean);
  return termos.length > 0 && termos.every((t) => palavras.some((p) => p.startsWith(t)));
}

export function veiculosDoCliente(veiculos: VeiculoCadastrado[], clienteId: string): VeiculoCadastrado[] {
  return veiculos.filter((v) => v.proprietario?.clienteId === clienteId);
}

/** Cadastros que podem ser a mesma pessoa do que foi digitado, do mais certo ao menos certo (máx. 4). */
export function buscarClientes(
  clientes: ClienteCarteira[],
  veiculos: VeiculoCadastrado[],
  d: DigitadoCliente,
  max = 4,
): CandidatoCliente[] {
  const nome = normalizarNome(d.nome);
  const tel = normalizarTelefone(d.tel);
  const doc = onlyDigits(d.doc || '');
  const email = (d.email || '').trim().toLowerCase();

  const achados: CandidatoCliente[] = [];
  for (const c of clientes) {
    const motivos: MotivoCliente[] = [];
    if (doc.length >= 11 && onlyDigits(c.cpfCnpj || '') === doc) motivos.push('cpf');
    if (email && (c.email || '').toLowerCase() === email) motivos.push('email');
    const mesmoNome = nome.length >= 3 && normalizarNome(c.nome) === nome;
    const mesmoTel = !!tel && normalizarTelefone(c.telefone || '') === tel;
    if (mesmoNome && mesmoTel) motivos.push('telefone_e_nome');
    else if (mesmoTel) motivos.push('telefone');
    if (!mesmoNome && nome.length >= 3 && nomeParecido(nome, normalizarNome(c.nome))) motivos.push('nome');
    if (mesmoNome && !mesmoTel) motivos.push('nome');
    if (motivos.length) achados.push({ cliente: c, motivos, qtdVeiculos: veiculosDoCliente(veiculos, c.id).length });
  }
  const nota = (x: CandidatoCliente) => Math.max(...x.motivos.map((m) => PESO[m]));
  return achados
    .sort((a, b) => nota(b) - nota(a) || a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR'))
    .slice(0, max);
}

/** Veículo cadastrado com esta placa (comparada sem hífen/caixa). Placa incompleta = nenhum. */
export function buscarVeiculoPorPlaca(veiculos: VeiculoCadastrado[], placa: string): VeiculoCadastrado | undefined {
  const p = formatPlaca(placa);
  if (!isValidPlaca(p)) return undefined;
  return veiculos.find((v) => formatPlaca(v.placa) === p);
}

/** "Toyota Corolla 2018" — a marca pode estar vazia nos veículos cadastrados pelo checklist. */
export function rotuloVeiculo(v: VeiculoCadastrado): string {
  return [v.marca, v.modelo, v.ano].filter(Boolean).join(' ');
}

// ── Formatação e validação centralizadas por tipo de campo ────────────────────
//
// Fonte única das regras de máscara/formatação/validação usadas pelo
// componente <Input>. Nenhuma página deve reimplementar isso — ver Seção 3/4
// do prompt de padronização. Cada formatador aqui segue o mesmo contrato:
// recebe o valor "cru" (bruto) e devolve a string formatada pra exibição; o
// valor que trafega por onChangeValue é sempre o valor cru (só dígitos, ou
// número decimal como string), nunca a string com máscara.

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

// ── CPF / CNPJ ──────────────────────────────────────────────────────────────

export function formatCPF(digits: string): string {
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCNPJ(digits: string): string {
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Detecta CPF (≤11 dígitos) vs CNPJ (12–14) automaticamente, conforme digita. */
export function formatCpfCnpj(rawValue: string): string {
  const d = onlyDigits(rawValue).slice(0, 14);
  return d.length > 11 ? formatCNPJ(d) : formatCPF(d);
}

function calcDigitoCPF(digits: string, len: number): number {
  let soma = 0;
  for (let i = 0; i < len; i++) soma += parseInt(digits[i], 10) * (len + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function isValidCPF(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  return (
    calcDigitoCPF(digits, 9) === parseInt(digits[9], 10) &&
    calcDigitoCPF(digits, 10) === parseInt(digits[10], 10)
  );
}

function calcDigitoCNPJ(digits: string, len: number): number {
  const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < len; i++) soma += parseInt(digits[i], 10) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isValidCNPJ(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  return (
    calcDigitoCNPJ(digits, 12) === parseInt(digits[12], 10) &&
    calcDigitoCNPJ(digits, 13) === parseInt(digits[13], 10)
  );
}

/** true só quando o valor está completo (11 ou 14 dígitos) E é válido — nunca
 * acusa erro enquanto a pessoa ainda está digitando. */
export function isValidCpfCnpj(rawValue: string): boolean {
  const d = onlyDigits(rawValue);
  if (d.length === 11) return isValidCPF(d);
  if (d.length === 14) return isValidCNPJ(d);
  return false;
}

// ── CEP ─────────────────────────────────────────────────────────────────────

export function formatCEP(rawValue: string): string {
  const d = onlyDigits(rawValue).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, '$1-$2');
}

// ── Telefone (BR) ───────────────────────────────────────────────────────────

/** Alterna fixo (10 dígitos) / celular (11) automaticamente, conforme digita. */
export function formatPhoneBR(rawValue: string): string {
  const d = onlyDigits(rawValue).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

// ── Placa (Brasil — padrão antigo ou Mercosul) ─────────────────────────────

export function formatPlaca(rawValue: string): string {
  return (rawValue || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function isValidPlaca(value: string): boolean {
  const v = formatPlaca(value);
  return /^[A-Z]{3}\d{4}$/.test(v) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(v);
}

// ── Moeda (BRL) ─────────────────────────────────────────────────────────────
// Contrato: o valor "cru" é sempre uma string numérica decimal ("1234.56"),
// igual ao que qualquer <input type="number"> já devolveria — pra não exigir
// nenhuma conversão especial de quem consome o campo. A exibição formatada
// ("R$ 1.234,56") é responsabilidade só do componente.

export function formatCurrencyBRL(rawValue: string): string {
  if (rawValue === '' || rawValue == null) return '';
  const n = Number(rawValue);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** A partir do valor digitado (com ou sem máscara), extrai os dígitos e
 * devolve a string decimal crua — trata o campo como um "teclado de
 * calculadora" (cada dígito novo entra nos centavos). */
export function parseCurrencyInput(typedValue: string): string {
  const digits = onlyDigits(typedValue);
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toFixed(2);
}

// ── E-mail ──────────────────────────────────────────────────────────────────

export function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

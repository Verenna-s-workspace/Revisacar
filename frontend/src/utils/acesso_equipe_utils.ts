// ── Acesso da equipe: funções puras (sem React, sem rede) ─────────────────────
//
// O código curto da oficina (ex.: ABCD-2345) vira o link /f/<código>. Abrir o link em qualquer
// aparelho guarda o CNPJ da oficina nele e já deixa o login de funcionário (nome + PIN) pronto.
// O formato é o mesmo do backend (orders/acesso_equipe_views.py): 8 caracteres, sem 0/O/1/I/L.

/** Chave do localStorage com o CNPJ da oficina pareada neste aparelho. */
export const DEVICE_OFICINA_KEY = 'revisacarDeviceOficinaDoc';

/** Marca (sessionStorage) pedindo que a tela de login abra no lado do funcionário. */
const ABRIR_FUNCIONARIO_KEY = 'revisacarAbrirComoFuncionario';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FORMATO = new RegExp(`^[${ALFABETO}]{8}$`);

/** 'abcd-2345' / 'ABCD 2345' → 'ABCD2345'. Não valida o formato. */
export function normalizarCodigo(texto: string | null | undefined): string {
  return (texto ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function codigoValido(texto: string | null | undefined): boolean {
  return FORMATO.test(normalizarCodigo(texto));
}

/** 'ABCD2345' → 'ABCD-2345' (como aparece na tela). */
export function formatarCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Link que o funcionário abre. `origem` = window.location.origin (o mesmo site do painel). */
export function urlDoAcesso(codigo: string, origem: string): string {
  return `${origem.replace(/\/+$/, '')}/f/${normalizarCodigo(codigo)}`;
}

/** Código da URL `/f/<código>` (já normalizado); null se o caminho não for de acesso da equipe. */
export function codigoDoCaminho(caminho: string): string | null {
  const m = /^\/f\/([A-Za-z0-9-]{8,12})\/?$/.exec(caminho);
  if (!m) return null;
  const codigo = normalizarCodigo(m[1]);
  return FORMATO.test(codigo) ? codigo : null;
}

export function mensagemDoWhatsApp(p: { url: string; oficina?: string }): string {
  const de = p.oficina ? ` da ${p.oficina}` : '';
  return `Olá! Para entrar no sistema${de} em qualquer computador, abra este link, escolha o seu nome e digite o seu PIN: ${p.url}`;
}

export function linkDoWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

// ── Preferência de abrir no lado do funcionário (vale só nesta aba) ───────────

export function pedirAberturaComoFuncionario(): void {
  try {
    sessionStorage.setItem(ABRIR_FUNCIONARIO_KEY, '1');
  } catch {
    // sessionStorage bloqueado: o funcionário usa o seletor Dono/Funcionário do painel
  }
}

export function deveAbrirComoFuncionario(): boolean {
  try {
    return sessionStorage.getItem(ABRIR_FUNCIONARIO_KEY) === '1';
  } catch {
    return false;
  }
}

export function limparAberturaComoFuncionario(): void {
  try {
    sessionStorage.removeItem(ABRIR_FUNCIONARIO_KEY);
  } catch {
    // sem sessionStorage: nada a limpar
  }
}

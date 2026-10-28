import type { Convite, ConviteSituacao } from '../types/convite';

/** Endereço do app do cliente (ex.: https://app.revisacar.com.br). Sem ele só o código é compartilhado. */
const CLIENT_APP_URL = (import.meta.env.VITE_CLIENT_APP_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/** Link que abre o app do cliente já com o convite preenchido; null se o endereço do app não estiver configurado. */
export function linkDoConvite(codigo: string): string | null {
  return CLIENT_APP_URL ? `${CLIENT_APP_URL}/?convite=${encodeURIComponent(codigo)}` : null;
}

export function situacaoDoConvite(c: Convite, agora: Date = new Date()): ConviteSituacao {
  if (c.revogadoEm) return 'revogado';
  if (new Date(c.expiraEm) <= agora) return 'expirado';
  if (c.maxUsos != null && c.usos >= c.maxUsos) return 'esgotado';
  return 'ativo';
}

export const SITUACAO_LABEL: Record<ConviteSituacao, string> = {
  ativo: 'Ativo', expirado: 'Expirado', esgotado: 'Esgotado', revogado: 'Cancelado',
};

/** Mensagem pronta para mandar por WhatsApp. */
export function mensagemDeConvite(nomeOficina: string, codigo: string): string {
  const link = linkDoConvite(codigo);
  return link
    ? `Olá! Use este link para entrar na ${nomeOficina} pelo app RevisaCar: ${link}`
    : `Olá! Para entrar na ${nomeOficina} pelo app RevisaCar, use o código: ${codigo}`;
}

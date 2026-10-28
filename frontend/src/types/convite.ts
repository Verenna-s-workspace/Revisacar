// ── Convites: tipos ───────────────────────────────────────────────────────────
// A oficina gera um convite (código/QR/link); o cliente do app o usa e entra na carteira dela.

export interface Convite {
  id: string;
  /** Código que o cliente digita ou escaneia (é o próprio id do convite). */
  codigo: string;
  criadoPorNome: string;
  createdAt: string;
  expiraEm: string;
  usos: number;
  maxUsos?: number;
  /** false quando revogado, expirado ou esgotado. */
  ativo: boolean;
  revogadoEm?: string;
}

export interface NovoConviteInput {
  /** Validade em dias (1 a 90). */
  dias: number;
  /** Limite de usos; omitido = ilimitado. */
  maxUsos?: number | null;
}

export type ConviteSituacao = 'ativo' | 'expirado' | 'esgotado' | 'revogado';

// Fotos obrigatórias da entrada do veículo — espelho de backend/orders/fotos_obrigatorias.py
// (manter em sincronia: mesmos ids, mesma ordem, mesmos limites de motivo).

export type SlotFoto = 'hodometro' | 'frente' | 'traseira' | 'lateral_direita' | 'lateral_esquerda';

export interface SlotConfig {
  id: SlotFoto;
  rotulo: string;
  dica?: string;
}

export const SLOTS_FOTO: readonly SlotConfig[] = [
  { id: 'hodometro', rotulo: 'Hodômetro', dica: 'Painel aceso, mostrando também os avisos' },
  { id: 'frente', rotulo: 'Frente' },
  { id: 'traseira', rotulo: 'Traseira' },
  { id: 'lateral_direita', rotulo: 'Lateral direita' },
  { id: 'lateral_esquerda', rotulo: 'Lateral esquerda' },
];

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 120;

/** Atalhos de "Não consigo tirar esta foto". O motivo também pode ser texto livre curto. */
export const MOTIVOS_PADRAO: readonly string[] = ['Carro trancado', 'Sem energia', 'Chuva'];

export type SituacaoFoto = 'pendente' | 'foto' | 'pulada';

export interface ItemFoto {
  slot: SlotFoto;
  rotulo: string;
  dica?: string;
  situacao: SituacaoFoto;
  path?: string;
  motivo?: string;
  porNome?: string;
  porTipo?: string;
  /** Quando foi tirada/pulada (ISO, hora do servidor). */
  em?: string;
  refeitas?: number;
}

export interface FotosObrigatorias {
  itens: ItemFoto[];
  total: number;
  resolvidas: number;
  completo: boolean;
  faltam: SlotFoto[];
}

/** Estado antes de o servidor responder: tudo pendente. */
export function fotosObrigatoriasVazias(): FotosObrigatorias {
  return {
    itens: SLOTS_FOTO.map((s) => ({ slot: s.id, rotulo: s.rotulo, ...(s.dica ? { dica: s.dica } : {}), situacao: 'pendente' as const })),
    total: SLOTS_FOTO.length,
    resolvidas: 0,
    completo: false,
    faltam: SLOTS_FOTO.map((s) => s.id),
  };
}

/** A regra vale para OS nova ou ainda em rascunho; OS que já passou da entrada não é cobrada. */
export const exigeFotosObrigatorias = (status: string | null | undefined) => !status || status === 'rascunho';

/** O servidor só aceita mudar o registro antes de o orçamento ser enviado. */
export const fotosEditaveis = (status: string | null | undefined) =>
  !status || status === 'rascunho' || status === 'em_orcamento';

export function textoFaltam(n: number): string {
  if (n <= 0) return 'Fotos obrigatórias completas';
  return n === 1 ? 'Falta 1 foto obrigatória' : `Faltam ${n} fotos obrigatórias`;
}

/** Limpa espaços e confere o tamanho (mesmas regras do servidor). */
export function validarMotivo(texto: string): { ok: true; motivo: string } | { ok: false; erro: string } {
  const motivo = texto.replace(/\s+/g, ' ').trim();
  if (motivo.length < MOTIVO_MIN) return { ok: false, erro: `Escreva pelo menos ${MOTIVO_MIN} letras.` };
  if (motivo.length > MOTIVO_MAX) return { ok: false, erro: `No máximo ${MOTIVO_MAX} caracteres.` };
  return { ok: true, motivo };
}

/** "22/10 14:32" (hora de Brasília). Vazio se a data for inválida. */
export function formatarQuando(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).replace(',', '');
}

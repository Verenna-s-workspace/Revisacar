// Linha do tempo da OS montada SÓ com o que já está registrado (cabeçalho da OS, fotos obrigatórias e
// assinatura). Não há registro de eventos no servidor ainda: nada aqui é inventado — o que não foi gravado não aparece.
import type { AssinaturaEntrada, OSHeader } from '../types';
import type { ItemFoto } from './fotos_obrigatorias';

export interface EventoOS { id: string; texto: string; quando?: string; por?: string; ms: number }

const ms = (iso?: string) => { const t = iso ? new Date(iso).getTime() : NaN; return Number.isNaN(t) ? 0 : t; };

export function eventosDaOS(i: { orderId: string | null; osHeader: OSHeader; fotos: ItemFoto[]; assinatura: AssinaturaEntrada }): EventoOS[] {
  const out: EventoOS[] = [];
  if (i.orderId && i.osHeader.os_date) {
    const iso = `${i.osHeader.os_date}T${i.osHeader.os_time || '00:00'}`;
    out.push({ id: 'criada', texto: 'Rascunho da OS criado', quando: iso, ms: ms(iso) });
  }
  for (const f of i.fotos) {
    if (f.situacao === 'foto') out.push({ id: `foto-${f.slot}`, texto: `Foto registrada: ${f.rotulo}`, quando: f.em, por: f.porNome, ms: ms(f.em) });
    if (f.situacao === 'pulada') out.push({ id: `pula-${f.slot}`, texto: `Sem foto: ${f.rotulo}${f.motivo ? ` (${f.motivo})` : ''}`, quando: f.em, por: f.porNome, ms: ms(f.em) });
  }
  const a = i.assinatura;
  if (a.status === 'assinada' && a.quando) out.push({ id: 'assinada', texto: 'Termo de recebimento assinado pelo cliente', quando: a.quando, por: a.por, ms: ms(a.quando) });
  if (a.status === 'adiada' && a.quando) out.push({ id: 'adiada', texto: 'Assinatura adiada: cliente ausente', quando: a.quando, por: a.por, ms: ms(a.quando) });
  return out.sort((x, y) => y.ms - x.ms);
}

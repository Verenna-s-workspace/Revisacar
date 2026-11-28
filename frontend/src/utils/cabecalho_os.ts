// Texto do cabeçalho da OS (título + meta) — o mesmo em todas as fases (Entrada, Diagnóstico, …).
import type { Cliente, OSHeader, Veiculo } from '../types';

/**
 * `titulo`: "Modelo · Ano". `meta`: "OS #… · Cliente · entrada dd/mm às hh:mm · N km".
 * Só junta o que existe; nada é inventado.
 */
export function montarCabecalhoOS(
  osHeader: Pick<OSHeader, 'os_num' | 'os_date' | 'os_time' | 'os_km'>,
  veiculo: Pick<Veiculo, 'modelo' | 'ano'>,
  cliente: Pick<Cliente, 'nome'>,
): { titulo: string; meta: string } {
  const [, mm, dd] = (osHeader.os_date || '').split('-');
  const entradaTxt = osHeader.os_date ? `entrada ${dd}/${mm}${osHeader.os_time ? ` às ${osHeader.os_time}` : ''}` : '';
  const kmTxt = osHeader.os_km ? `${Number(osHeader.os_km).toLocaleString('pt-BR')} km` : '';
  const meta = [`OS #${osHeader.os_num}`, cliente.nome, entradaTxt, kmTxt].filter(Boolean).join(' · ');
  const titulo = [veiculo.modelo, veiculo.ano].filter(Boolean).join(' · ');
  return { titulo, meta };
}

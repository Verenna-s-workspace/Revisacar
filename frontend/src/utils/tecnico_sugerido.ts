// ── Sugestão do técnico logado ────────────────────────────────────────────────
// Campos de "nome do técnico" que fazem parte de uma ação normal (encerramento do checklist) já
// vêm preenchidos com o nome de quem está logado. Fica editável: quem fez o serviço pode ser outro.
//
// Não se aplica a telas de cadastro/configuração (Funcionários, Minha conta): lá o nome é o dado
// em edição, não "quem está fazendo a ação".

import { formatNome } from '../components/inputs/masks';
import { LIM, validarNome } from './campos_checklist';
import type { AuthResult } from '../types';

/** Cargos que NÃO executam serviço: o nome deles não é sugerido como técnico responsável. */
const CARGOS_SEM_SUGESTAO: ReadonlySet<string> = new Set(['atendente']);

/**
 * Nome do usuário logado pronto para o campo do técnico, ou '' quando não deve haver sugestão
 * (sem login, cargo que não executa serviço, nome que o próprio campo recusaria).
 * Passa pelo mesmo filtro e limite do campo, para o valor sugerido nunca ser inválido.
 */
export function nomeSugeridoParaTecnico(user: Pick<AuthResult, 'nome' | 'tipo' | 'cargo'> | null | undefined): string {
  if (!user) return '';
  if (user.tipo === 'funcionario' && CARGOS_SEM_SUGESTAO.has(String(user.cargo || '').toLowerCase())) return '';
  const nome = formatNome(String(user.nome || ''), LIM.nome).replace(/\s+/g, ' ').trim();
  return nome && !validarNome(nome) ? nome : '';
}

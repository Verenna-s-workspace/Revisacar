// ── API pública do orçamento (link do cliente) ───────────────────────────────
// SEM login: não manda Authorization e não tenta refresh de token. O token do
// link na URL é a credencial.

import { API_BASE } from '../constants';
import type { OrcamentoPublico } from '../types/orcamento_link';

export class ErroPublico extends Error {
  constructor(public status: number, public codigo: string | undefined, mensagem: string, public corpo?: Record<string, unknown>) {
    super(mensagem);
  }
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new ErroPublico(0, 'rede', 'Sem conexão. Verifique a internet e tente de novo.');
  }
  const texto = await res.text().catch(() => '');
  let corpo: Record<string, unknown> | undefined;
  try { corpo = texto ? JSON.parse(texto) : undefined; } catch { corpo = undefined; }
  if (!res.ok) {
    throw new ErroPublico(res.status, typeof corpo?.codigo === 'string' ? corpo.codigo : undefined,
      typeof corpo?.detail === 'string' ? corpo.detail : `HTTP ${res.status}`, corpo);
  }
  return corpo as T;
}

const base = (token: string) => `/publico/orcamentos/${encodeURIComponent(token)}`;

export const apiPublica = {
  obterOrcamento: (token: string) => chamar<OrcamentoPublico>(base(token)),
  aprovar: (token: string, dados: { nome: string; aceito: true; observacao?: string }) =>
    chamar<OrcamentoPublico>(`${base(token)}/aprovar`, { method: 'POST', body: JSON.stringify(dados) }),
  recusar: (token: string, dados: { motivo?: string }) =>
    chamar<OrcamentoPublico>(`${base(token)}/recusar`, { method: 'POST', body: JSON.stringify(dados) }),
  /** URL do PDF (abre numa aba nova; é um GET sem login). */
  urlDoPdf: (token: string) => `${API_BASE}${base(token)}/pdf`,
};

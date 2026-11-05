// ── Erros da API: mensagens pensadas para quem usa o sistema, não para quem programa ──
//
// Toda resposta de erro do backend passa por `criarErroDaResposta` (ver `handleResponse`
// em api.ts). O `message` do erro lançado já vem em português e legível — assim qualquer
// tela que mostre `err.message` mostra algo que a pessoa entende, nunca JSON cru, HTML de
// erro 500 ou "Failed to fetch". O corpo original continua disponível em `corpo` (e em
// `corpoDoErro`) para quem precisa de campos extras, como `codigo` ou `validos`.

/** Erro de uma chamada ao backend. `message` é sempre texto para o usuário final. */
export class ApiError extends Error {
  constructor(
    /** Status HTTP; 0 = a requisição nem chegou ao servidor (sem internet, servidor fora do ar). */
    public status: number,
    mensagem: string,
    /** Corpo da resposta, já convertido de JSON (ou null se não era JSON). */
    public corpo: Record<string, unknown> | null = null,
    /** Texto que o próprio servidor mandou, quando era legível — null se tivemos que usar a mensagem do status. */
    public textoDoServidor: string | null = null,
  ) {
    super(mensagem);
    this.name = 'ApiError';
  }
}

// ── Mensagem pelo status, quando o servidor não explicou nada legível ──

const MSG_REDE = 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';

export function mensagemPorStatus(status: number): string {
  if (status === 0) return MSG_REDE;
  if (status === 400) return 'Não foi possível processar o pedido. Confira os dados e tente de novo.';
  if (status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (status === 403) return 'Você não tem permissão para fazer isso.';
  if (status === 404) return 'Não encontramos o que você procurou.';
  if (status === 409) return 'Esses dados já estão cadastrados.';
  if (status === 413) return 'O arquivo enviado é grande demais. Escolha um menor.';
  if (status === 422) return 'Confira os dados informados e tente de novo.';
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (status === 502 || status === 503 || status === 504) {
    return 'O servidor está indisponível ou iniciando. Aguarde alguns segundos e tente de novo.';
  }
  if (status >= 500) return 'Tivemos um problema do nosso lado. Tente de novo em instantes.';
  return 'Algo deu errado. Tente de novo.';
}

/** Status em que a mensagem genérica já diz mais do que o "não foi possível salvar…" de cada tela. */
const STATUS_INFORMATIVOS = new Set([0, 401, 403, 413, 429]);

// ── Texto vindo do corpo da resposta ──

/** Nome interno do campo → como a pessoa o conhece. */
const ROTULOS: Record<string, string> = {
  doc: 'CNPJ', cnpj: 'CNPJ', cpf: 'CPF',
  senha: 'Senha', pin: 'PIN',
  email: 'E-mail', nome: 'Nome',
  tel: 'Telefone', telefone: 'Telefone',
  placa: 'Placa', modelo: 'Modelo', marca: 'Marca', ano: 'Ano', cor: 'Cor', chassi: 'Chassi',
  km: 'Quilometragem', cargo: 'Cargo', cep: 'CEP', endereco: 'Endereço',
  descricao: 'Descrição', quantidade: 'Quantidade', valor: 'Valor', data: 'Data',
};

/**
 * Texto que é recado para quem programa, não para quem usa: pilha de erro, SQL, HTML, JSON de
 * dentro do banco, "rode a migration…", "confira a chave no supabase.env". Esses não aparecem na
 * tela — viram a mensagem do status (e o original vai para o console em desenvolvimento).
 */
const PARECE_TECNICO = new RegExp([
  'traceback', 'exception', 'apierror', 'postgrest', 'pgrst', 'duplicate key', 'violates', 'constraint',
  'relation "', 'column "', 'syntax error', '<\\s*html', '<!doctype', '\\{\\s*[\'"]', 'undefined', '\\bnull\\b',
  '\\[object ',
  '\\bbackend\\b', 'supabase', '\\bsql\\b', '\\.sql\\b', '\\.env\\b', '\\bmigrations?\\b', 'banco de dados',
  '\\b(no|do|ao) banco\\b', '\\bo banco\\b', '\\btabelas?\\b', '\\bcolunas?\\b', '\\bgatilho\\b',
].join('|'), 'i');

/** Recados genéricos de "corpo da requisição" (JSON malformado): a pessoa não tem o que corrigir nos campos. */
const CORPO_INVALIDO = /^corpo( da requisi[cç][aã]o)? inv[aá]lido/i;
/** Sessão: o backend responde isso quando o token de acesso não vale mais. */
const SESSAO_INVALIDA = /^token inv[aá]lido ou expirado/i;

/** Mensagens genéricas do DRF/Django em inglês (caso alguma escape sem tradução). */
const INGLES_OBRIGATORIO = /(this field is required|may not be (blank|null)|field is required|required)\.?$/i;
const INGLES_EMAIL = /valid email/i;
const INGLES_INVALIDO = /not a valid|valid (integer|number|string|date)|\binvalid\b/i;

/** "Campo obrigatório", "Este campo é obrigatório" etc. não dizem QUAL campo — aí o rótulo ajuda. */
const GENERICA_PT = /^(este\s+)?campo\b/i;

function rotuloDe(chave: string): string | undefined {
  return ROTULOS[chave] ?? ROTULOS[chave.toLowerCase()];
}

function traduzir(texto: string, chave?: string): string | null {
  const t = texto.trim();
  if (!t || t.length > 280 || PARECE_TECNICO.test(t)) return null;
  const rotulo = chave && chave !== 'detail' && chave !== 'non_field_errors' ? rotuloDe(chave) : undefined;

  if (CORPO_INVALIDO.test(t)) return 'Os dados enviados não são válidos. Recarregue a página e tente de novo.';
  if (SESSAO_INVALIDA.test(t)) return 'Sua sessão expirou. Entre de novo.';
  if (INGLES_EMAIL.test(t)) return 'Informe um e-mail válido.';
  if (INGLES_OBRIGATORIO.test(t)) return rotulo ? `Preencha o campo ${rotulo}.` : 'Preencha todos os campos obrigatórios.';
  if (INGLES_INVALIDO.test(t) && /^[\x00-\x7F]+$/.test(t)) return rotulo ? `${rotulo} inválido.` : 'Há dados inválidos. Confira e tente de novo.';
  if (GENERICA_PT.test(t) && rotulo) return `${rotulo}: ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  return t;
}

/** Junta as mensagens do corpo ({detail}, {campo: "msg"}, {campo: ["msg"]}) numa frase só, sem repetir. */
export function textoDoCorpo(corpo: unknown): string | null {
  const textos: string[] = [];
  const coletar = (v: unknown, chave?: string) => {
    if (typeof v === 'string') {
      const t = traduzir(v, chave);
      if (t && !textos.includes(t)) textos.push(t);
    } else if (Array.isArray(v)) {
      v.forEach(x => coletar(x, chave));
    } else if (v && typeof v === 'object') {
      Object.entries(v).forEach(([k, x]) => {
        // Campos que o backend usa para a máquina (lista de status válidos, códigos), não para a pessoa.
        if (k === 'validos' || k === 'codigo' || k === 'code') return;
        coletar(x, k);
      });
    }
  };
  coletar(corpo);
  return textos.length ? textos.join(' ') : null;
}

function lerCorpo(texto: string): Record<string, unknown> | null {
  if (!texto) return null;
  try {
    const dado = JSON.parse(texto);
    return dado && typeof dado === 'object' && !Array.isArray(dado) ? (dado as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Monta o erro de uma resposta HTTP que veio com falha (status fora de 2xx). */
export function criarErroDaResposta(status: number, textoDaResposta: string): ApiError {
  // Quem desenvolve ainda precisa do detalhe técnico: fica no console (nunca na tela do usuário).
  if (import.meta.env.DEV) console.warn(`[API] erro ${status}:`, textoDaResposta.slice(0, 500));
  const corpo = lerCorpo(textoDaResposta);
  const doServidor = corpo ? textoDoCorpo(corpo) : null;
  return new ApiError(status, doServidor ?? mensagemPorStatus(status), corpo, doServidor);
}

const ERROS_DE_REDE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_connection/i;

/** Falha antes de haver resposta (sem internet, servidor fora do ar, CORS). Cancelamento (AbortError) passa intacto. */
export function erroDeRede(erro: unknown): unknown {
  if (erro instanceof ApiError) return erro;
  if (erro instanceof Error && erro.name === 'AbortError') return erro;
  return new ApiError(0, MSG_REDE);
}

// ── Helpers usados pelas telas e hooks ──

/**
 * Mensagem para mostrar à pessoa. `padrao` é o texto da própria tela ("Não foi possível salvar o
 * cliente…") e só entra quando o servidor não disse nada legível e o status não explica melhor.
 */
export function mensagemDoErro(e: unknown, padrao: string): string {
  if (e instanceof ApiError) {
    return e.textoDoServidor ?? (STATUS_INFORMATIVOS.has(e.status) ? e.message : padrao);
  }
  if (e instanceof Error) {
    if (ERROS_DE_REDE.test(e.message)) return MSG_REDE;
    // Erros antigos/de fora trazem o corpo JSON como texto.
    const doCorpo = textoDoCorpo(lerCorpo(e.message));
    if (doCorpo) return doCorpo;
  }
  return padrao;
}

/** Corpo JSON do erro (o que o backend mandou), ou null se não houver. */
export function corpoDoErro<T = Record<string, unknown>>(e: unknown): T | null {
  if (e instanceof ApiError) return e.corpo as T | null;
  return lerCorpo(e instanceof Error ? e.message : '') as T | null;
}

/** Chave presente com valor `undefined` = "limpar o campo": JSON.stringify
 *  descartaria a chave e o backend entenderia "não mexer", então vira null. */
export function limparOpcionais<T extends object>(patch: T, chaves: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(patch as Record<string, unknown>) };
  for (const k of chaves) {
    if (k in patch && (patch as Record<string, unknown>)[k as string] === undefined) out[k as string] = null;
  }
  return out;
}

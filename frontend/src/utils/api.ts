import { API_BASE } from '../constants';

let accessToken = '';
let refreshToken = '';

// O backend invalida o refresh token a cada renovação. Por isso: (1) uma renovação por vez —
// várias chamadas com 401 juntas esperam a mesma, senão as que chegam depois usam um token já
// invalidado e derrubam a sessão; (2) o par novo é gravado (AuthContext), senão recarregar a
// página volta com o token velho; (3) se não der pra renovar, a sessão acabou e o app volta ao login.
let renovacaoEmCurso: Promise<void> | null = null;
let aoAtualizarTokens: ((access: string, refresh: string) => void) | null = null;
let aoExpirarSessao: (() => void) | null = null;

const renovarTokens = (): Promise<void> => {
  if (!renovacaoEmCurso) {
    const usado = refreshToken;
    renovacaoEmCurso = (async () => {
      try {
        const nova = await api.refreshToken(usado);
        if (!nova?.accessToken) throw new Error('Sessão expirada');
        accessToken = nova.accessToken;
        refreshToken = nova.refreshToken;
        aoAtualizarTokens?.(accessToken, refreshToken);
      } catch (erro) {
        accessToken = '';
        refreshToken = '';
        aoExpirarSessao?.();
        throw erro;
      }
    })().finally(() => { renovacaoEmCurso = null; });
  }
  return renovacaoEmCurso;
};

const baseHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  // 204 (DELETE) e outras respostas sem corpo não são JSON válido — tentar
  // res.json() nelas quebra mesmo quando a chamada deu certo.
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

/** Upload (FormData): o navegador precisa montar o Content-Type com o boundary; fixar
 *  application/json aqui faria o servidor ver um corpo multipart como JSON (sem arquivos). */
const semContentTypeFixo = (headers: Record<string, string>, init: RequestInit) => {
  if (typeof FormData !== 'undefined' && init.body instanceof FormData) delete headers['Content-Type'];
  return headers;
};

/** Leitura (GET) que cai por falha de rede ("Failed to fetch": servidor do Render acordando,
 *  conexão oscilando) tenta de novo antes de desistir. Escritas nunca repetem sozinhas,
 *  pra não gravar duas vezes. */
const fetchComRetentativa = async (input: RequestInfo, init: RequestInit) => {
  const leitura = !init.method || init.method.toUpperCase() === 'GET';
  const tentativas = leitura ? 3 : 1;
  for (let i = 1; ; i++) {
    try {
      return await fetch(input, init);
    } catch (erro) {
      if (i >= tentativas || (typeof navigator !== 'undefined' && !navigator.onLine)) throw erro;
      await new Promise(r => setTimeout(r, 700 * i));
    }
  }
};

const authFetch = async (input: RequestInfo, init: RequestInit = {}) => {
  const headers = semContentTypeFixo({
    ...baseHeaders,
    ...(init.headers as Record<string, string> | undefined),
  }, init);

  const tokenUsado = accessToken;
  if (tokenUsado) {
    headers.Authorization = `Bearer ${tokenUsado}`;
  }

  const response = await fetchComRetentativa(input, {
    ...init,
    headers,
  });

  if (response.status === 401 && (refreshToken || accessToken !== tokenUsado)) {
    // Outra chamada pode já ter renovado enquanto esta estava no ar: aí só repete com o token novo.
    if (accessToken === tokenUsado) await renovarTokens();

    const retryHeaders = semContentTypeFixo({
      ...baseHeaders,
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`
    }, init);

    const retryResponse = await fetchComRetentativa(input, {
      ...init,
      headers: retryHeaders,
    });
    return handleResponse(retryResponse);
  }

  return handleResponse(response);
};

/** Baixa um arquivo (PDF) autenticado como Blob; renova o token uma vez se preciso. */
const authFetchBlob = async (url: string): Promise<Blob> => {
  const buscar = () => fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  const tokenUsado = accessToken;
  let res = await buscar();
  if (res.status === 401 && (refreshToken || accessToken !== tokenUsado)) {
    if (accessToken === tokenUsado) await renovarTokens();
    res = await buscar();
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.blob();
};

export const api = {
  setAuthTokens: (access: string, refresh: string) => {
    accessToken = access;
    refreshToken = refresh;
  },

  clearAuthTokens: () => {
    accessToken = '';
    refreshToken = '';
  },

  /** AuthContext grava o par renovado e volta ao login quando a sessão acaba. */
  aoRenovarSessao: (atualizar: (access: string, refresh: string) => void, expirar: () => void) => {
    aoAtualizarTokens = atualizar;
    aoExpirarSessao = expirar;
  },

  criarOrdem: (payload: unknown) =>
    authFetch(`${API_BASE}/ordens`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarOrdem: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/ordens/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** Muda o status da OS (transições conferidas no servidor: 409 se não for permitida). */
  definirStatusOrdem: (id: string, status: string) =>
    authFetch(`${API_BASE}/ordens/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  uploadFotos: (orderId: string, formData: FormData) =>
    authFetch(`${API_BASE}/ordens/${orderId}/fotos`, {
      method: 'POST',
      body: formData,
      headers: {},
    }),

  /** Fotos obrigatórias da entrada (5 itens fixos): estado, uma foto por vez e "não consigo tirar". */
  fotosObrigatorias: (orderId: string) =>
    authFetch(`${API_BASE}/ordens/${orderId}/fotos-obrigatorias`),

  enviarFotoObrigatoria: (orderId: string, slot: string, arquivo: Blob) => {
    const formData = new FormData();
    formData.append('file', arquivo, `${slot}.jpg`);
    return authFetch(`${API_BASE}/ordens/${orderId}/fotos-obrigatorias/${slot}`, {
      method: 'PUT',
      body: formData,
    });
  },

  pularFotoObrigatoria: (orderId: string, slot: string, motivo: string) =>
    authFetch(`${API_BASE}/ordens/${orderId}/fotos-obrigatorias/${slot}/pular`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }),

  deleteFoto: (orderId: string, fotoPath: string) =>
    authFetch(`${API_BASE}/ordens/${orderId}/fotos/${encodeURIComponent(fotoPath)}`, {
      method: 'DELETE',
    }),

  listarOrdens: () => authFetch(`${API_BASE}/ordens`),

  obterOrdem: (id: string) => authFetch(`${API_BASE}/ordens/${id}`),

  deletarOrdem: (id: string) => authFetch(`${API_BASE}/ordens/${id}`, { method: 'DELETE' }),

  // ── Agendamentos ────────────────────────────────────────────────────────────

  listarAgendamentos: () => authFetch(`${API_BASE}/agendamentos`),

  obterAgendamento: (id: string) => authFetch(`${API_BASE}/agendamentos/${id}`),

  criarAgendamento: (payload: unknown) =>
    authFetch(`${API_BASE}/agendamentos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarAgendamento: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/agendamentos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deletarAgendamento: (id: string) => authFetch(`${API_BASE}/agendamentos/${id}`, { method: 'DELETE' }),

  // ── Veículos ─────────────────────────────────────────────────────────────────

  listarVeiculos: () => authFetch(`${API_BASE}/veiculos`),

  obterVeiculo: (id: string) => authFetch(`${API_BASE}/veiculos/${id}`),

  criarVeiculo: (payload: unknown) =>
    authFetch(`${API_BASE}/veiculos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarVeiculo: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/veiculos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deletarVeiculo: (id: string) => authFetch(`${API_BASE}/veiculos/${id}`, { method: 'DELETE' }),

  // ── Clientes ─────────────────────────────────────────────────────────────────

  listarClientes: () => authFetch(`${API_BASE}/clientes`),

  obterCliente: (id: string) => authFetch(`${API_BASE}/clientes/${id}`),

  criarCliente: (payload: unknown) =>
    authFetch(`${API_BASE}/clientes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarCliente: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/clientes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deletarCliente: (id: string) => authFetch(`${API_BASE}/clientes/${id}`, { method: 'DELETE' }),

  // ── Catálogo de Serviços ─────────────────────────────────────────────────────

  listarServicos: () => authFetch(`${API_BASE}/servicos`),

  obterServico: (id: string) => authFetch(`${API_BASE}/servicos/${id}`),

  criarServico: (payload: unknown) =>
    authFetch(`${API_BASE}/servicos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarServico: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/servicos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deletarServico: (id: string) => authFetch(`${API_BASE}/servicos/${id}`, { method: 'DELETE' }),

  // ── Estoque ────────────────────────────────

  listarEstoque: () => authFetch(`${API_BASE}/estoque`),

  obterItemEstoque: (id: string) => authFetch(`${API_BASE}/estoque/${id}`),

  criarItemEstoque: (payload: unknown) =>
    authFetch(`${API_BASE}/estoque`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarItemEstoque: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/estoque/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deletarItemEstoque: (id: string) => authFetch(`${API_BASE}/estoque/${id}`, { method: 'DELETE' }),

  listarMovimentosEstoque: () => authFetch(`${API_BASE}/estoque/movimentos`),

  // ── Kits de Estoque ────────────────────────

  listarKits: () => authFetch(`${API_BASE}/kits`),

  obterKit: (id: string) => authFetch(`${API_BASE}/kits/${id}`),

  criarKit: (payload: unknown) =>
    authFetch(`${API_BASE}/kits`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarKit: (id: string, payload: unknown) =>
    authFetch(`${API_BASE}/kits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deletarKit: (id: string) => authFetch(`${API_BASE}/kits/${id}`, { method: 'DELETE' }),

  /** Aplica a receita do kit: valida, deduz cada componente e registra as saidas. */
  aplicarKit: (id: string) => authFetch(`${API_BASE}/kits/${id}/aplicar`, { method: 'POST' }),

  criarAdmin: (payload: unknown) =>
    fetch(`${API_BASE}/admin/signup`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(payload),
    }).then(handleResponse),

  loginAdmin: (payload: unknown) =>
    fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(payload),
    }).then(handleResponse),

  refreshToken: (refresh: string) =>
    fetch(`${API_BASE}/admin/refresh`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ refreshToken: refresh }),
    }).then(handleResponse),

  logout: (refresh: string) =>
    fetch(`${API_BASE}/admin/logout`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ refreshToken: refresh }),
    }).then(handleResponse),

  forgotPassword: (payload: { email: string }) =>
    fetch(`${API_BASE}/admin/forgot-password`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(payload),
    }).then(handleResponse),

  resetPassword: (payload: { token: string; senha: string }) =>
    fetch(`${API_BASE}/admin/reset-password`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(payload),
    }).then(handleResponse),

  // ── Funcionários (RBAC) ─────────────────────────────────────────────────────
  // Login de funcionário é por PIN (6 dígitos), não senha — ver rbac.py.

  /** Lista pra tela de login em quiosque. Sem token — ninguém logou ainda. */
  listarFuncionariosPublicos: (oficinaDoc: string) =>
    fetch(`${API_BASE}/funcionarios/publicos?oficina_doc=${encodeURIComponent(oficinaDoc)}`, {
      headers: baseHeaders,
    }).then(handleResponse),

  loginFuncionarioPin: (payload: { funcionario_id: string; pin: string }) =>
    fetch(`${API_BASE}/funcionarios/login-pin`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(payload),
    }).then(handleResponse),

  esqueciPin: (email: string) =>
    fetch(`${API_BASE}/funcionarios/forgot-pin`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ email }),
    }).then(handleResponse),

  /** Estes 4 exigem 'funcionarios.gerenciar' — o backend reforça isso. */
  listarFuncionarios: () => authFetch(`${API_BASE}/funcionarios`),

  criarFuncionario: (payload: { nome: string; email: string; pin: string; cargo: string }) =>
    authFetch(`${API_BASE}/funcionarios/signup`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  atualizarFuncionario: (id: string, payload: { cargo?: string; ativo?: boolean; pin?: string }) =>
    authFetch(`${API_BASE}/funcionarios/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  removerFuncionario: (id: string) =>
    authFetch(`${API_BASE}/funcionarios/${id}`, { method: 'DELETE' }),

  /** Quem estou logado, e o que posso fazer — pra sincronizar sessão sem decodificar JWT no front. */
  me: () => authFetch(`${API_BASE}/me`),

  // ── Financeiro ───────────────────────────────────────────────────────────────
  // GET exige financeiro.ver, POST/PATCH/DELETE exigem financeiro.editar —
  // o backend reforça isso, aqui é só o cliente HTTP.

  categoriasFinanceiro: () => fetch(`${API_BASE}/financeiro/categorias`, { headers: baseHeaders }).then(handleResponse),

  listarTransacoes: (params?: { de?: string; ate?: string; tipo?: 'entrada' | 'saida'; status?: 'pendente' | 'pago'; semPeriodo?: boolean; tz?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tz) qs.set('tz', params.tz);
    if (params?.de) qs.set('de', params.de);
    if (params?.ate) qs.set('ate', params.ate);
    if (params?.tipo) qs.set('tipo', params.tipo);
    if (params?.status) qs.set('status', params.status);
    if (params?.semPeriodo) qs.set('sem_periodo', '1');
    const query = qs.toString();
    return authFetch(`${API_BASE}/financeiro/transacoes${query ? `?${query}` : ''}`);
  },

  criarTransacao: (payload: Record<string, unknown>) =>
    authFetch(`${API_BASE}/financeiro/transacoes`, { method: 'POST', body: JSON.stringify(payload) }),

  atualizarTransacao: (id: string, payload: Record<string, unknown>) =>
    authFetch(`${API_BASE}/financeiro/transacoes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  removerTransacao: (id: string) =>
    authFetch(`${API_BASE}/financeiro/transacoes/${id}`, { method: 'DELETE' }),

  resumoFinanceiro: (params?: { de?: string; ate?: string; tz?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tz) qs.set('tz', params.tz);
    if (params?.de) qs.set('de', params.de);
    if (params?.ate) qs.set('ate', params.ate);
    const query = qs.toString();
    return authFetch(`${API_BASE}/financeiro/resumo${query ? `?${query}` : ''}`);
  },

  // ── Orçamento da OS ──────────────────────────────────────────────────────────
  // Ler: ordens.ver. Criar versão/editar/enviar/aprovar/recusar: ordens.editar.
  // Custo e margem só vêm pra quem tem financeiro.ver_margem. `tz` = fuso do usuário
  // (a validade conta em dias desse fuso).

  listarOrcamentos: (ordemId: string, tz?: string) =>
    authFetch(`${API_BASE}/ordens/${ordemId}/orcamentos${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`),

  criarVersaoOrcamento: (ordemId: string) =>
    authFetch(`${API_BASE}/ordens/${ordemId}/orcamentos`, { method: 'POST' }),

  atualizarOrcamento: (id: string, payload: Record<string, unknown>) =>
    authFetch(`${API_BASE}/orcamentos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  enviarOrcamento: (id: string, tz?: string) =>
    authFetch(`${API_BASE}/orcamentos/${id}/enviar${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`, { method: 'POST' }),

  aprovarOrcamento: (id: string, payload: { canal?: string; observacao?: string; assinatura?: string | null }, tz?: string) =>
    authFetch(`${API_BASE}/orcamentos/${id}/aprovar${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Resumo da etapa 4: orçamento aprovado, reservas, baixas e lançamentos da OS. */
  obterFechamento: (ordemId: string) => authFetch(`${API_BASE}/ordens/${ordemId}/fechamento`),

  /** Conclui o serviço e baixa o estoque reservado (409 `estoque_insuficiente` se faltar peça). */
  concluirOrdem: (ordemId: string, payload: { observacao?: string; ignorarFaltas?: boolean }) =>
    authFetch(`${API_BASE}/ordens/${ordemId}/concluir`, { method: 'POST', body: JSON.stringify(payload) }),

  /** PDF da versão (só preço cobrado). */
  // Link público do orçamento (Fase 6). Ver: ordens.ver; gerar/renovar/revogar: ordens.editar.
  obterLinkOrcamento: (id: string) => authFetch(`${API_BASE}/orcamentos/${id}/link`),
  gerarLinkOrcamento: (id: string, renovar = false) =>
    authFetch(`${API_BASE}/orcamentos/${id}/link`, { method: 'POST', body: JSON.stringify({ renovar }) }),
  revogarLinkOrcamento: (id: string) => authFetch(`${API_BASE}/orcamentos/${id}/link`, { method: 'DELETE' }),

  baixarPdfOrcamento: (id: string) => authFetchBlob(`${API_BASE}/orcamentos/${id}/pdf`),

  recusarOrcamento: (id: string, payload: { motivo?: string }) =>
    authFetch(`${API_BASE}/orcamentos/${id}/recusar`, { method: 'POST', body: JSON.stringify(payload) }),

  // ── Alertas ──────────────────────────────────────────────────────────────────
  // Marcar: ordens.editar ou ordens.criar (503 se o script alertas.sql não foi rodado).
  marcarClienteAvisado: (ordemId: string, avisado: boolean) =>
    authFetch(`${API_BASE}/ordens/${ordemId}/cliente-avisado`, { method: 'PATCH', body: JSON.stringify({ avisado }) }),

  /** Dados dos alertas de orçamento, OS parada, reserva sem estoque e pagamento (cada bloco só vem pra quem pode ver). */
  obterAlertas: (tz?: string) => authFetch(`${API_BASE}/alertas${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`),

  // Adiar/dispensar é por usuário (qualquer logado). 503 se alertas.sql não foi rodado.
  adiarAlerta: (alertaId: string, dias: number) =>
    authFetch(`${API_BASE}/alertas/dispensados/${encodeURIComponent(alertaId)}`, { method: 'PUT', body: JSON.stringify({ modo: 'adiar', dias }) }),
  dispensarAlerta: (alertaId: string) =>
    authFetch(`${API_BASE}/alertas/dispensados/${encodeURIComponent(alertaId)}`, { method: 'PUT', body: JSON.stringify({ modo: 'dispensar' }) }),
  restaurarAlerta: (alertaId: string) =>
    authFetch(`${API_BASE}/alertas/dispensados/${encodeURIComponent(alertaId)}`, { method: 'DELETE' }),
  /** Apaga só os DISPENSADOS cujo alerta já se resolveu (pra, se voltar, voltar a aparecer). */
  limparAlertasDispensados: (ids: string[]) =>
    authFetch(`${API_BASE}/alertas/dispensados/limpar`, { method: 'POST', body: JSON.stringify({ ids }) }),

  // ── Visão Geral ──────────────────────────────────────────────────────────────
  // Qualquer usuário logado lê; os blocos de dinheiro vêm só para quem pode ver.
  visaoGeral: (tz?: string) => authFetch(`${API_BASE}/visao-geral${tz ? `?tz=${encodeURIComponent(tz)}` : ''}`),

  // Exige configuracoes.editar. `null` remove a meta.
  definirMetaMensal: (valor: number | null) =>
    authFetch(`${API_BASE}/visao-geral/meta`, { method: 'PUT', body: JSON.stringify({ valor }) }),

  // ── Relatórios ───────────────────────────────────────────────────────────────
  // Exige relatorios.ver (dono e gerente). Datas YYYY-MM-DD; o servidor agrega
  // por dia no fuso `tz` e devolve só os totais/séries (ver RelatorioResposta).
  relatorios: (params: { de: string; ate: string; deAnterior?: string; ateAnterior?: string; tz?: string }) => {
    const qs = new URLSearchParams({ de: params.de, ate: params.ate });
    if (params.deAnterior && params.ateAnterior) {
      qs.set('de_anterior', params.deAnterior);
      qs.set('ate_anterior', params.ateAnterior);
    }
    if (params.tz) qs.set('tz', params.tz);
    return authFetch(`${API_BASE}/relatorios?${qs.toString()}`);
  },

  baixarFoto: (filename: string) => fetch(`${API_BASE}/fotos/${filename}`).then(handleResponse),
};
import { API_BASE } from '../constants';

let accessToken = '';
let refreshToken = '';

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

const authFetch = async (input: RequestInfo, init: RequestInit = {}) => {
  const headers = {
    ...baseHeaders,
    ...(init.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401 && refreshToken) {
    try {
      const refreshResponse = await api.refreshToken(refreshToken);
      if (refreshResponse.accessToken) {
        accessToken = refreshResponse.accessToken;
        refreshToken = refreshResponse.refreshToken;

        const retryHeaders = {
          ...baseHeaders,
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${accessToken}`
        };

        const retryResponse = await fetch(input, {
          ...init,
          headers: retryHeaders,
        });
        return handleResponse(retryResponse);
      }
    } catch (refreshError) {
      accessToken = '';
      refreshToken = '';
      throw refreshError;
    }
  }

  return handleResponse(response);
};

/** Baixa um arquivo (PDF) autenticado como Blob; renova o token uma vez se preciso. */
const authFetchBlob = async (url: string): Promise<Blob> => {
  const buscar = () => fetch(url, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  let res = await buscar();
  if (res.status === 401 && refreshToken) {
    const nova = await api.refreshToken(refreshToken);
    if (nova.accessToken) {
      accessToken = nova.accessToken;
      refreshToken = nova.refreshToken;
      res = await buscar();
    }
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
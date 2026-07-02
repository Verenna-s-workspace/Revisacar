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
  return res.json();
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

  baixarFoto: (filename: string) => fetch(`${API_BASE}/fotos/${filename}`).then(handleResponse),
};
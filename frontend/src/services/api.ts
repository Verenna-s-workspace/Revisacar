import axios, { AxiosError } from 'axios';
import type {
  CustomerSession, CustomerProfile, Vehicle, VehicleFormData,
  Appointment, Estimate, ServiceHistory, Notification,
  MaintenanceReminder, DashboardSummary, AuthTokens,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
const BYPASS = import.meta.env.VITE_BYPASS_LOGIN === 'true';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// ── Attach JWT to every request ───────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem('customer_session');
  if (raw) {
    try {
      const session: CustomerSession = JSON.parse(raw);
      if (session.access) config.headers.Authorization = `Bearer ${session.access}`;
    } catch { /* ignore */ }
  }
  return config;
});

// ── Auto-refresh on 401 ───────────────────────────────────────────────────────
let refreshing = false;
apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const orig = error.config as any;
    if (error.response?.status === 401 && !orig._retry && !refreshing) {
        // When bypassing login for local dev, don't attempt refresh or redirect —
        // prevent the app from forcing navigation back to `/` on 401s.
        if (BYPASS) return Promise.reject(error);

        orig._retry = true;
        refreshing = true;
        try {
          const raw = localStorage.getItem('customer_session');
          if (raw) {
            const session: CustomerSession = JSON.parse(raw);
            const { data } = await axios.post(`${BASE_URL}/customer/auth/refresh`, { refresh: session.refresh });
            session.access = data.access;
            localStorage.setItem('customer_session', JSON.stringify(session));
            orig.headers.Authorization = `Bearer ${data.access}`;
            return apiClient(orig);
          }
        } catch {
          localStorage.removeItem('customer_session');
          window.location.href = '/';
        } finally {
          refreshing = false;
        }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { name: string; email: string; phone: string; password: string; password_confirm: string }) =>
    apiClient.post<AuthTokens & { customer: { id: string; name: string; email: string } }>('/customer/auth/register', data),

  login: (email: string, password: string) =>
    apiClient.post<AuthTokens & { customer: { id: string; name: string; email: string } }>('/customer/auth/login', { email, password }),

  forgotPassword: (email: string) =>
    apiClient.post('/customer/auth/forgot-password', { email }),
};

// ── Profile ───────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () => apiClient.get<CustomerProfile>('/customer/me'),
  update: (data: Partial<CustomerProfile>) => apiClient.patch<CustomerProfile>('/customer/me', data),
  changePassword: (data: { old_password: string; new_password: string; new_password_confirm: string }) =>
    apiClient.post('/customer/me/change-password', data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: () => apiClient.get<DashboardSummary>('/customer/dashboard'),
};

// ── Vehicles ──────────────────────────────────────────────────────────────────

export const vehiclesApi = {
  list: () => apiClient.get<Vehicle[]>('/customer/vehicles'),
  get: (id: string) => apiClient.get<Vehicle>(`/customer/vehicles/${id}`),
  create: (data: VehicleFormData) => apiClient.post<Vehicle>('/customer/vehicles', data),
  update: (id: string, data: Partial<VehicleFormData>) => apiClient.patch<Vehicle>(`/customer/vehicles/${id}`, data),
  delete: (id: string) => apiClient.delete(`/customer/vehicles/${id}`),
};

// ── Appointments ──────────────────────────────────────────────────────────────

export const appointmentsApi = {
  list: (statusFilter?: string) =>
    apiClient.get<Appointment[]>('/customer/appointments', { params: statusFilter ? { status: statusFilter } : {} }),
  get: (id: string) => apiClient.get<Appointment>(`/customer/appointments/${id}`),
  create: (data: {
    vehicle_id: string; service_type: string; service_description?: string;
    date: string; time_slot: string; notes?: string;
  }) => apiClient.post<Appointment>('/customer/appointments', data),
  cancel: (id: string) => apiClient.delete(`/customer/appointments/${id}`),
};

// ── Availability ──────────────────────────────────────────────────────────────
// Helpers for mock availability when BYPASS is enabled
function makeAvailableDates(year: number, month: number) {
  const dates: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const day = d.getDay();
    // weekdays only
    if (day !== 0 && day !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${dd}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const DEFAULT_TIMES = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];

export const availabilityApi = {
  getDays: (year: number, month: number) => {
    if (BYPASS) {
      return Promise.resolve({ data: { year, month, available_dates: makeAvailableDates(year, month) } });
    }
    return apiClient.get<{ year: number; month: number; available_dates: string[] }>('/customer/availability', { params: { year, month } });
  },
  getTimes: (date: string) => {
    if (BYPASS) {
      return Promise.resolve({ data: { date, times: DEFAULT_TIMES } });
    }
    return apiClient.get<{ date: string; times: string[] }>('/customer/availability/times', { params: { date } });
  },
};

// ── Estimates ─────────────────────────────────────────────────────────────────

export const estimatesApi = {
  list: (statusFilter?: string) =>
    apiClient.get<Estimate[]>('/customer/estimates', { params: statusFilter ? { status: statusFilter } : {} }),
  get: (id: string) => apiClient.get<Estimate>(`/customer/estimates/${id}`),
  approve: (id: string, comment?: string) =>
    apiClient.post(`/customer/estimates/${id}`, { action: 'aprovar', comment }),
  reject: (id: string, comment?: string) =>
    apiClient.post(`/customer/estimates/${id}`, { action: 'rejeitar', comment }),
};

// ── History ───────────────────────────────────────────────────────────────────

export const historyApi = {
  list: (vehicleId?: string) =>
    apiClient.get<ServiceHistory[]>('/customer/history', { params: vehicleId ? { vehicle_id: vehicleId } : {} }),
  get: (id: string) => apiClient.get<ServiceHistory>(`/customer/history/${id}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (unreadOnly = false) =>
    apiClient.get<Notification[]>('/customer/notifications', { params: unreadOnly ? { unread: 'true' } : {} }),
  markRead: (id: string) => apiClient.post(`/customer/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/customer/notifications/read-all'),
};

// ── Reminders ─────────────────────────────────────────────────────────────────

export const remindersApi = {
  list: () => apiClient.get<MaintenanceReminder[]>('/customer/reminders'),
};

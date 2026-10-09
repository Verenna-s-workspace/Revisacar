import axios, { AxiosError } from 'axios';
import type {
  CustomerSession, CustomerProfile, Vehicle, VehicleFormData,
  Appointment, Estimate, ServiceHistory, Notification,
  MaintenanceReminder, DashboardSummary, AuthTokens,
} from '../types';
import { useAuthStore } from '@/store/auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
const BYPASS = import.meta.env.VITE_BYPASS_LOGIN === 'true';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// ── Attach JWT to every request ───────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  try {
    const session = useAuthStore.getState().session;
    if (session) {
      config.headers.Authorization = `Bearer ${session.access}`;
    }
    return config;
  } catch (error) {
    return config;
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string; document: string; pincode: string }) =>
    apiClient.post<AuthTokens & { customer: CustomerSession }>('/customer/auth/register', data),
  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthTokens & { customer: CustomerSession }>('/customer/auth/login', data),
  refresh: () => {
    const session = useAuthStore.getState().session;
    if (session?.refresh) {
      return apiClient.post<AuthTokens & { customer: CustomerSession }>('/customer/auth/refresh', { refresh: session.refresh });
    }
    return Promise.reject(new Error('No refresh token available'));
  },
  forgotPassword: (email: string) => apiClient.post('/customer/auth/forgot-password', { email }),
  pinLogin: (data: { document: string; pincode: string }) =>
    apiClient.post<AuthTokens & { customer: CustomerSession }>('/customer/auth/pin-login', data),
};

// ── Profile ───────────────────────────────────────────────────────────────────
export const profileApi = {
  get: () => apiClient.get<CustomerProfile>('/customer/me'),
  update: (data: Partial<CustomerProfile>) => apiClient.patch<CustomerProfile>('/customer/me', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post('/customer/me/change-password', data),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  // This endpoint is assumed to exist for mechanics to fetch customer details by id
  // In the customer app, this might not be available, but we are using it for the mechanic view in the customer app?
  // Alternatively, we can use the profileApi for the logged-in customer.
  // Since the ClientesPage is for a specific customer (from the route), we assume the endpoint exists.
  getById: (id: string) => apiClient.get<CustomerProfile>(`/customer/${id}`),
};

// ── Vehicles ──────────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list: () => apiClient.get<Vehicle[]>('/customer/vehicles'),
  get: (id: string) => apiClient.get<Vehicle>(`/customer/vehicles/${id}`),
  create: (data: VehicleFormData) => apiClient.post<Vehicle>('/customer/vehicles', data),
  update: (id: string, data: VehicleFormData) => apiClient.patch<Vehicle>(`/customer/vehicles/${id}`, data),
  delete: (id: string) => apiClient.delete(`/customer/vehicles/${id}`),
};

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointmentsApi = {
  list: (status?: string) => {
    const params = status ? { status } : {};
    return apiClient.get<Appointment[]>('/customer/appointments', { params });
  },
  get: (id: string) => apiClient.get<Appointment>(`/customer/appointments/${id}`),
  create: (data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) =>
    apiClient.post<Appointment>('/customer/appointments', data),
  cancel: (id: string) => apiClient.delete(`/customer/appointments/${id}`),
};

// ── Availability ──────────────────────────────────────────────────────────────
export const availableDaysApi = {
  get: (year: number, month: number) =>
    apiClient.get<{ available_dates: string[] }>('/customer/availability', { params: { year, month } }),
};

export const availableTimesApi = {
  get: (date: string) =>
    apiClient.get<{ times: string[] }>('/customer/availability/times', { params: { date } }),
};

// ── Estimates ─────────────────────────────────────────────────────────────────
export const estimatesApi = {
  list: (status?: string) => {
    const params = status ? { status } : {};
    return apiClient.get<Estimate[]>('/customer/estimates', { params });
  },
  get: (id: string) => apiClient.get<Estimate>(`/customer/estimates/${id}`),
  updateStatus: (id: string, new_status: string, comment: string = "") =>
    apiClient.patch<Estimate>(`/customer/estimates/${id}`, { status: new_status, customer_comment: comment }),
};

// ── Service History ───────────────────────────────────────────────────────────
export const serviceHistoryApi = {
  list: (vehicleId?: string) => {
    const params = vehicleId ? { vehicle_id: vehicleId } : {};
    return apiClient.get<ServiceHistory[]>('/customer/service_history', { params });
  },
  get: (id: string) => apiClient.get<ServiceHistoryItem>(`/customer/service_history/${id}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/customer/notifications'),
  markAsRead: (id: string) => apiClient.post(`/customer/notifications/${id}/read`),
  markAllAsRead: () => apiClient.post('/customer/notifications/read-all'),
};

// ── Reminders ─────────────────────────────────────────────────────────────────
export const remindersApi = {
  list: () => apiClient.get<MaintenanceReminder[]>('/customer/reminders'),
};
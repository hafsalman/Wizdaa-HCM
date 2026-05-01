import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'URL';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// ─── Auth ──────────────────────────────────────────────────
export const authApi = {
  seedToken: (name: string, email: string, role: string) =>
    api.post('/auth/seed-token', { name, email, role }),
};

// ─── Employees ─────────────────────────────────────────────
export const employeeApi = {
  getAll: () => api.get('/employees'),
  getOne: (id: string) => api.get(`/employees/${id}`),
  getBalances: (id: string) => api.get(`/employees/${id}/balances`),
};

// ─── Balances ──────────────────────────────────────────────
export const balanceApi = {
  get: (employeeId: string, locationId: string, leaveType?: string) =>
    api.get(`/balances/${employeeId}/${locationId}`, { params: { leaveType } }),
  refresh: (employeeId: string, locationId: string) =>
    api.post(`/balances/refresh/${employeeId}/${locationId}`),
};

// ─── Time-Off Requests ────────────────────────────────────
export const timeOffApi = {
  create: (data: {
    employeeId: string;
    locationId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    startHalf?: boolean;
    endHalf?: boolean;
    reason?: string;
  }, idempotencyKey?: string) =>
    api.post('/time-off/requests', data, {
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {},
    }),
  list: (params?: { employeeId?: string; status?: string; locationId?: string }) =>
    api.get('/time-off/requests', { params }),
  getOne: (id: string) => api.get(`/time-off/requests/${id}`),
  approve: (id: string) => api.patch(`/time-off/requests/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.patch(`/time-off/requests/${id}/reject`, { reason }),
  cancel: (id: string) => api.delete(`/time-off/requests/${id}`),
};

// ─── Holidays ──────────────────────────────────────────────
export const holidayApi = {
  getAll: (year?: number) => api.get('/holidays', { params: { year } }),
  seed: (year?: number) => api.post('/holidays/seed', { year }),
};

// ─── Sync ──────────────────────────────────────────────────
export const syncApi = {
  triggerSync: (employeeId: string, locationId: string) =>
    api.post('/sync/trigger', { employeeId, locationId }),
  listJobs: () => api.get('/sync/jobs'),
};

// ─── Health ────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health'),
};

// ─── Audit ─────────────────────────────────────────────────
export const auditApi = {
  getAll: () => api.get('/audit'),
  getByEntity: (entityType: string, entityId: string) =>
    api.get('/audit/entity', { params: { entityType, entityId } }),
};

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* no body */ }

  if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
  return data;
}

export const authApi = {
  login:  (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  verify: (token) => request('/auth/verify', { token }),
};

export const dashboardApi = {
  getSummary: (token) => request('/dashboard/summary', { token }),
};

export const sensorsApi = {
  getAll:     (token) => request('/sensors', { token }),
  getSummary: (token) => request('/sensors/summary', { token }),
};

export const irrigationApi = {
  getZones:       (token)         => request('/irrigation/zones', { token }),
  toggleZone:     (zoneId, token) => request(`/irrigation/zones/${zoneId}/toggle`, { method: 'PATCH', token }),
  getSchedules:   (token)         => request('/irrigation/schedules', { token }),
  createSchedule: (data, token)   => request('/irrigation/schedules', { method: 'POST', body: data, token }),
  updateSchedule: (id, data, token) => request(`/irrigation/schedules/${id}`, { method: 'PUT', body: data, token }),
  deleteSchedule: (id, token)     => request(`/irrigation/schedules/${id}`, { method: 'DELETE', token }),
};

export const alertsApi = {
  getAll:   (token, limit) => request(`/alerts${limit ? `?limit=${limit}` : ''}`, { token }),
  markRead: (id, token)    => request(`/alerts/${id}/read`, { method: 'PATCH', token }),
};

export const productsApi = {
  getAll:  (token)            => request('/products', { token }),
  create:  (data, token)      => request('/products', { method: 'POST', body: data, token }),
  update:  (id, data, token)  => request(`/products/${id}`, { method: 'PUT', body: data, token }),
  delete:  (id, token)        => request(`/products/${id}`, { method: 'DELETE', token }),
};

export const ordersApi = {
  getAll:        (token)            => request('/orders', { token }),
  getOne:        (id, token)        => request(`/orders/${id}`, { token }),
  create:        (data, token)      => request('/orders', { method: 'POST', body: data, token }),
  updateStatus:  (id, status, note, token) => request(`/orders/${id}/status`, { method: 'PATCH', body: { status, note }, token }),
  updatePayment: (id, payment, token)      => request(`/orders/${id}/payment`, { method: 'PATCH', body: { payment }, token }),
  delete:        (id, token)        => request(`/orders/${id}`, { method: 'DELETE', token }),
};

export const usersApi = {
  getAll:        (token)           => request('/users', { token }),
  create:        (data, token)     => request('/users', { method: 'POST', body: data, token }),
  setRole:       (id, role, token) => request(`/users/${id}/role`, { method: 'PATCH', body: { role }, token }),
  setStatus:     (id, status, token) => request(`/users/${id}/status`, { method: 'PATCH', body: { status }, token }),
  resetPassword: (id, token)       => request(`/users/${id}/reset-password`, { method: 'POST', token }),
  delete:        (id, token)       => request(`/users/${id}`, { method: 'DELETE', token }),
};

export const settingsApi = {
  get:    (token)        => request('/settings', { token }),
  update: (data, token)  => request('/settings', { method: 'PUT', body: data, token }),
};

export const logsApi = {
  getAll: (token, limit, category) => 
    request(`/logs?limit=${limit || 50}&category=${category || 'all'}`, { token }),
};

export { ApiError };

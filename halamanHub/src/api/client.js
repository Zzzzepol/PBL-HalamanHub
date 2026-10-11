const PAGE_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_HOST = /^(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-z0-9-]+\.local)$/i.test(PAGE_HOST) ? PAGE_HOST : 'localhost';
const API_BASE = process.env.REACT_APP_API_URL || `http://${API_HOST}:4000/api`;

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
  getHistory: (token, hours, location) => request(`/sensors/history?hours=${hours || 24}${location ? `&location=${encodeURIComponent(location)}` : ''}`, { token }),
  getLocations: (token) => request('/sensors/locations', { token }),
};

export const irrigationApi = {
  getSettings: (token)       => request('/irrigation/settings', { token }),
  updateSettings:(data, token) => request('/irrigation/settings', { method: 'PUT', body: data, token }),
  resetLockout: (token) => request('/irrigation/reset-lockout', { method: 'POST', token }),
  getLogs: (token, limit, hours) =>
    request(`/irrigation/logs?limit=${limit || 50}${hours ? `&hours=${hours}` : ''}`, { token }),
};

export const alertsApi = {
  getAll:   (token, limit) => request(`/alerts${limit ? `?limit=${limit}` : ''}`, { token }),
  markRead: (id, token)    => request(`/alerts/${id}/read`, { method: 'PATCH', token }),
};

export const productsApi = {
  getAll:  (token)            => request('/products', { token }),
  create:  (data, token)      => request('/products', { method: 'POST', body: data, token }),
  createFromPlantProfile: (profileId, data, token) => request(`/products/from-plant-profile/${profileId}`, { method: 'POST', body: data, token }),
  update:  (id, data, token)  => request(`/products/${id}`, { method: 'PUT', body: data, token }),
  delete:  (id, token)        => request(`/products/${id}`, { method: 'DELETE', token }),
};

export const plantProfilesApi = {
  getAll: (token) => request('/plant-profiles', { token }),
  create: (data, token) => request('/plant-profiles', { method: 'POST', body: data, token }),
  update: (id, data, token) => request(`/plant-profiles/${id}`, { method: 'PUT', body: data, token }),
  delete: (id, token) => request(`/plant-profiles/${id}`, { method: 'DELETE', token }),
  importFromShop: (productId, token) => request(`/plant-profiles/import-shop/${productId}`, { method: 'POST', token }),
  syncShop: (token) => request('/plant-profiles/sync-shop', { method: 'POST', token }),
  sync: (token) => request('/plant-profiles/sync', { method: 'POST', token }),
};

export const monitoringSetupApi = {
  get: (token) => request('/monitoring-setup', { token }),
  update: (data, token) => request('/monitoring-setup', { method: 'PUT', body: data, token }),
  completeCheck: (key, notes, token) => request(`/monitoring-setup/checks/${key}`, { method: 'POST', body: { notes }, token }),
};

export const ordersApi = {
  getAll:        (token)            => request('/orders', { token }),
  getSummary:    (token)            => request('/orders/summary', { token }),
  createPOSSale: (data, token)      => request('/orders/pos', { method: 'POST', body: data, token }),
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
  changePassword: (currentPassword, newPassword, token) =>
    request('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword }, token }),
};

export const settingsApi = {
  get:    (token)        => request('/settings', { token }),
  update: (data, token)  => request('/settings', { method: 'PUT', body: data, token }),
};

export const reportsApi = {
  generate: async (params, token) => {
    const query = new URLSearchParams(params).toString();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/reports/generate?${query}`, { headers });

    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try { const data = await res.json(); msg = data.message || msg; } catch { /* no JSON body */ }
      throw new ApiError(msg, res.status);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    return { blob, filename: match ? match[1] : 'report' };
  },
};

export const logsApi = {
  getAll: (token, limit, category) => 
    request(`/logs?limit=${limit || 50}&category=${category || 'all'}`, { token }),
};

export { ApiError };

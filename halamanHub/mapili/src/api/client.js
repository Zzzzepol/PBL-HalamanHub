// Mapili Shop — API client
// Connects to the same HalamanHub backend (port 4000)

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
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

// Products (public)
export const productsApi = {
  getAll:  () => request('/shop/products'),
  getOne:  (id) => request(`/shop/products/${id}`),
};

// Customer auth
export const customerAuthApi = {
  register: (data)     => request('/shop/auth/register', { method: 'POST', body: data }),
  login:    (data)     => request('/shop/auth/login',    { method: 'POST', body: data }),
  verify:   (token)    => request('/shop/auth/verify',   { token }),
  update:   (data, token) => request('/shop/auth/profile', { method: 'PUT', body: data, token }),
  changePassword: (data, token) => request('/shop/auth/change-password', { method: 'PUT', body: data, token }),
};

// Orders
export const shopOrdersApi = {
  create:       (data, token)  => request('/shop/orders',      { method: 'POST', body: data, token }),
  getAll:       (token)        => request('/shop/orders',      { token }),
  getOne:       (id, token)    => request(`/shop/orders/${id}`,{ token }),
  reorder:      (id, token)    => request(`/shop/orders/${id}/reorder`, { method: 'POST', token }),
  expire:       (id, token)    => request(`/shop/orders/${id}/expire`, { method: 'PATCH', token }),
  abandon:      (id, token)    => request(`/shop/orders/${id}/abandon`, { method: 'PATCH', token }),
 validateStock:(items) => request('/shop/orders/validate-stock', { method: 'POST', body: { items } }),
  viewReceipt: async (id, token) => {
    const res = await fetch(`${API_BASE}/shop/orders/${id}/receipt`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new ApiError('Failed to load receipt.', res.status);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Don't revoke immediately — the new tab needs the URL to still be valid
    // while it loads. Clean it up after a delay instead.
    setTimeout(() => window.URL.revokeObjectURL(url), 30000);
  },
};

// PayMongo
export const paymongoApi = {
  createSource:  (data, token) => request('/shop/payment/create-source',  { method: 'POST', body: data, token }),
  createIntent:  (data, token) => request('/shop/payment/create-intent',  { method: 'POST', body: data, token }),
  createLink:    (data, token) => request('/shop/payment/create-link',    { method: 'POST', body: data, token }),
};
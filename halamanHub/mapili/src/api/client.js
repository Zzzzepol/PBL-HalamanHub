// Mapili Shop — API client
// Connects to the same HalamanHub backend (port 4000)

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// AuthContext registers a handler here on mount — lets this plain module
// (no React context of its own) trigger a logout+redirect from anywhere,
// without every single page needing its own 401-handling code.
let onSessionExpired = null;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
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

  // Only treat this as "session expired" when a token was actually sent —
  // a 401 from a plain login attempt (wrong password) is a normal failed
  // login, not an expired session, and must NOT trigger a redirect loop.
  if (res.status === 401 && token) {
    onSessionExpired?.();
  }

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
  google:   (credential) => request('/shop/auth/google', { method: 'POST', body: { credential } }),
  completeProfile: (data, token) => request('/shop/auth/complete-profile', { method: 'PUT', body: data, token }),
  verify:   (token)    => request('/shop/auth/verify',   { token }),
  update:   (data, token) => request('/shop/auth/profile', { method: 'PUT', body: data, token }),
  changePassword: (data, token) => request('/shop/auth/change-password', { method: 'PUT', body: data, token }),
  forgotPassword: (email) => request('/shop/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (tokenStr, newPassword) => request('/shop/auth/reset-password', { method: 'POST', body: { token: tokenStr, newPassword } }),
  verifyEmail: (tokenStr) => request('/shop/auth/verify-email', { method: 'POST', body: { token: tokenStr } }),
  resendVerification: (token) => request('/shop/auth/resend-verification', { method: 'POST', token }),
};

// Saved addresses
export const addressesApi = {
  getAll:      (token)             => request('/shop/auth/addresses', { token }),
  add:         (data, token)       => request('/shop/auth/addresses', { method: 'POST', body: data, token }),
  update:      (id, data, token)   => request(`/shop/auth/addresses/${id}`, { method: 'PUT', body: data, token }),
  remove:      (id, token)         => request(`/shop/auth/addresses/${id}`, { method: 'DELETE', token }),
  setPrimary:  (id, token)         => request(`/shop/auth/addresses/${id}/primary`, { method: 'PATCH', token }),
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
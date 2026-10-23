const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');
export function getToken() { return localStorage.getItem('sharesafe_token'); }
export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'Unable to complete this request.'); }
  return response;
}
export async function authRequest(path, payload) { const response = await fetch(`${API}/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to sign in.'); return data; }

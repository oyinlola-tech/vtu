const apiBase =
  document.querySelector('meta[name="api-base"]')?.content?.trim() || '';
const tokenKey = 'gly_vtu_access_token';
const deviceKey = 'gly_vtu_device_id';
const csrfKey = 'gly_vtu_csrf_token';

function getToken() {
  return localStorage.getItem(tokenKey);
}

function setToken(token) {
  localStorage.setItem(tokenKey, token);
}

function clearToken() {
  localStorage.removeItem(tokenKey);
}

function getCsrfToken() {
  return localStorage.getItem(csrfKey);
}

function setCsrfToken(token) {
  if (token) localStorage.setItem(csrfKey, token);
}

function clearCsrfToken() {
  localStorage.removeItem(csrfKey);
}

function getDeviceId() {
  let id = localStorage.getItem(deviceKey);
  if (!id) {
    id = `dev-${crypto.randomUUID()}`;
    localStorage.setItem(deviceKey, id);
  }
  return id;
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const csrfToken = getCsrfToken();
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed');
  }
  return response.json();
}

export {
  apiBase,
  api,
  getToken,
  setToken,
  clearToken,
  getDeviceId,
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
};

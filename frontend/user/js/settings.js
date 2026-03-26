import { api, clearToken, clearCsrfToken } from '/api/client.js';
import { initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  ensureAuth();
  const logoutBtn = document.querySelector('[data-logout]');
  logoutBtn?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    clearToken();
    clearCsrfToken();
    window.location.href = '/login';
  });
});

import { api, clearToken } from '/api/client.js';
import { initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  ensureAuth();
  const logoutBtn = document.querySelector('[data-logout]');
  logoutBtn?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    clearToken();
    window.location.href = '/login';
  });
});

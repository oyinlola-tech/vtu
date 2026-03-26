import { api, clearToken } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  ensureAuth();
  const logoutBtn = document.querySelector('[data-logout]');
  logoutBtn?.addEventListener('click', async () => {
    await api('/api/admin/auth/logout', { method: 'POST' });
    clearToken();
    window.location.href = '/admin/login';
  });
});

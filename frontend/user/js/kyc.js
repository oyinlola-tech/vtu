import { api } from '/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  ensureAuth();
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const level = Number(payload.level || 1);
    delete payload.level;
    try {
      showLoader(true, 'Submitting KYC...');
      await api('/api/user/kyc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, payload }),
      });
      alert('KYC submitted');
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

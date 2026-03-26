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
    try {
      showLoader(true, 'Creating request...');
      const result = await api('/api/wallet/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert(`Request created. Ref: ${result.reference}`);
      form.reset();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

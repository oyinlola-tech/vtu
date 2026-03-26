import { api, setToken } from '/admin/api/client.js';
import { showLoader, initTheme } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Signing in...');
      const data = await api('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setToken(data.accessToken);
      window.location.href = '/admin/dashboard';
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

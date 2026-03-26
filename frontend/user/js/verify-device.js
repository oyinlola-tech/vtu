import { api, setToken, getDeviceId, setCsrfToken } from '/api/client.js';
import { showLoader, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const emailField = document.querySelector('[data-email]');
  const email = sessionStorage.getItem('pending_email');
  if (emailField) emailField.textContent = email || '';
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.email = email;
    payload.deviceId = getDeviceId();
    try {
      showLoader(true, 'Verifying device...');
      const data = await api('/api/auth/verify-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setToken(data.accessToken);
      setCsrfToken(data.csrfToken);
      sessionStorage.removeItem('pending_email');
      window.location.href = '/dashboard';
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

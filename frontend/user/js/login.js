import { api, setToken, getDeviceId, setCsrfToken } from '/api/client.js';
import { showLoader, showBanner, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.deviceId = getDeviceId();
    try {
      showLoader(true, 'Signing in...');
      const data = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (data.otpRequired) {
        sessionStorage.setItem('pending_email', payload.email);
        window.location.href = '/verify-device';
        return;
      }
      setToken(data.accessToken);
      setCsrfToken(data.csrfToken);
      window.location.href = '/dashboard';
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

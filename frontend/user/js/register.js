import { api, setToken, getDeviceId } from '/api/client.js';
import { showLoader, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Creating account...');
      await api('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const login = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          deviceId: getDeviceId(),
        }),
      });
      if (login.otpRequired) {
        sessionStorage.setItem('pending_email', payload.email);
        window.location.href = '/verify-device';
        return;
      }
      setToken(login.accessToken);
      window.location.href = '/dashboard';
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

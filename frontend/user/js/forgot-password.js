import { api } from '/api/client.js';
import { showLoader, showBanner, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Sending OTP...');
      await api('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      sessionStorage.setItem('reset_email', payload.email);
      window.location.href = '/reset-password';
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

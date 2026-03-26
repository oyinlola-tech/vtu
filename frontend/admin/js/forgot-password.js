import { api } from '/admin/api/client.js';
import { showLoader, initTheme } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Sending OTP...');
      await api('/api/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      sessionStorage.setItem('admin_reset_email', payload.email);
      window.location.href = '/admin/reset-password';
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

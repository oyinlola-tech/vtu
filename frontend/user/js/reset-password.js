import { api } from '/api/client.js';
import { showLoader, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const email = sessionStorage.getItem('reset_email');
  const emailField = document.querySelector('[data-email]');
  if (emailField) emailField.textContent = email || '';
  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.email = email;
    try {
      showLoader(true, 'Resetting password...');
      await api('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      sessionStorage.removeItem('reset_email');
      alert('Password reset successful');
      window.location.href = '/login';
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

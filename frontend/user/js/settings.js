import { api, clearToken, clearCsrfToken } from '/api/client.js';
import { initTheme, initNav, ensureAuth, showLoader } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const logoutBtn = document.querySelector('[data-logout]');
  const setupForm = document.querySelector('[data-pin-setup]');
  const changeForm = document.querySelector('[data-pin-change]');
  const biometricToggle = document.querySelector('[data-biometric]');

  async function refreshSecurity() {
    try {
      const status = await api('/api/user/security');
      if (status.hasPin) {
        setupForm.hidden = true;
        changeForm.hidden = false;
      } else {
        setupForm.hidden = false;
        changeForm.hidden = true;
      }
      biometricToggle.checked = Boolean(status.biometricEnabled);
    } catch (err) {
      console.error(err);
    }
  }

  setupForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(setupForm).entries());
    try {
      showLoader(true, 'Creating PIN...');
      await api('/api/user/pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Transaction PIN created.');
      setupForm.reset();
      await refreshSecurity();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });

  changeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(changeForm).entries());
    try {
      showLoader(true, 'Updating PIN...');
      await api('/api/user/pin/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Transaction PIN updated.');
      changeForm.reset();
      await refreshSecurity();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });

  biometricToggle?.addEventListener('change', async () => {
    try {
      await api('/api/user/biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: biometricToggle.checked }),
      });
    } catch (err) {
      alert(err.message);
      biometricToggle.checked = !biometricToggle.checked;
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    clearToken();
    clearCsrfToken();
    window.location.href = '/login';
  });

  await refreshSecurity();
});

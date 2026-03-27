import { api, clearToken, clearCsrfToken } from '/api/client.js';
import { initTheme, initNav, ensureAuth, showLoader, showBanner } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const logoutBtn = document.querySelector('[data-logout]');
  const setupForm = document.querySelector('[data-pin-setup]');
  const changeForm = document.querySelector('[data-pin-change]');
  const biometricToggle = document.querySelector('[data-biometric]');
  const questionForm = document.querySelector('[data-security-question-form]');
  const questionSelect = document.querySelector('[data-security-question]');
  const questionStatus = document.querySelector('[data-security-question-status]');

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

      const questions = await api('/api/user/security-questions');
      questionSelect.innerHTML =
        '<option value=\"\">Select a question</option>' +
        questions.map((q) => `<option value=\"${q}\">${q}</option>`).join('');
      const current = await api('/api/user/security-question');
      if (current.question) {
        questionSelect.value = current.question;
        if (questionStatus) {
          questionStatus.textContent = `Last updated: ${new Date(
            current.updatedAt
          ).toLocaleString()}`;
        }
      }
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
      showBanner('Transaction PIN created.', 'success');
      setupForm.reset();
      await refreshSecurity();
    } catch (err) {
      showBanner(err.message, 'error');
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
      showBanner('Transaction PIN updated.', 'success');
      changeForm.reset();
      await refreshSecurity();
    } catch (err) {
      showBanner(err.message, 'error');
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
      showBanner(err.message, 'error');
      biometricToggle.checked = !biometricToggle.checked;
    }
  });

  questionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(questionForm).entries());
    try {
      showLoader(true, 'Saving security question...');
      await api('/api/user/security-question/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showBanner('Security question updated.', 'success');
      questionForm.reset();
      await refreshSecurity();
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
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

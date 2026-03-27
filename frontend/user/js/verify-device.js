import { api, setToken, getDeviceId, setCsrfToken } from '/api/client.js';
import { showLoader, showBanner, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const emailField = document.querySelector('[data-email]');
  const email = sessionStorage.getItem('pending_email');
  if (emailField) emailField.textContent = email || '';
  const securityAnswerInput = document.querySelector('input[name="securityAnswer"]');
  const securityQuestionText = document.querySelector('[data-security-question-text]');
  if (email) {
    try {
      const question = await api('/api/auth/security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (question?.enabled && question.question) {
        if (securityQuestionText) {
          securityQuestionText.textContent = `Question: ${question.question}`;
        }
        if (securityAnswerInput) securityAnswerInput.required = true;
      }
    } catch (err) {
      if (securityQuestionText) securityQuestionText.textContent = '';
    }
  }
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
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

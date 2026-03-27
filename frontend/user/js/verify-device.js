import { api, setToken, getDeviceId, setCsrfToken } from '/api/client.js';
import { showLoader, showBanner, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const emailField = document.querySelector('[data-email]');
  const email = sessionStorage.getItem('pending_email');
  if (emailField) emailField.textContent = email || '';
  const securityAnswerInput = document.querySelector('input[name="securityAnswer"]');
  const securityQuestionText = document.querySelector('[data-security-question-text]');
  const codeInput = document.querySelector('input[name="code"]');
  const securityAlt = document.querySelector('[data-security-alt]');
  const securityAltWrap = securityAlt?.closest('.section-gap');
  let securityEnabled = false;

  function applySecurityMode(useSecurity) {
    if (!codeInput || !securityAnswerInput) return;
    if (!securityEnabled) {
      codeInput.required = true;
      codeInput.disabled = false;
      securityAnswerInput.required = false;
      return;
    }
    codeInput.required = !useSecurity;
    codeInput.disabled = Boolean(useSecurity);
    if (useSecurity) codeInput.value = '';
    securityAnswerInput.required = Boolean(useSecurity);
  }
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
        securityEnabled = true;
        if (securityAlt) securityAlt.checked = false;
        applySecurityMode(false);
      } else {
        applySecurityMode(false);
      }
    } catch (err) {
      if (securityQuestionText) securityQuestionText.textContent = '';
      applySecurityMode(false);
    }
  }
  if (!email) {
    applySecurityMode(false);
  }
  if (!securityEnabled && securityAltWrap) {
    securityAltWrap.style.display = 'none';
  }
  securityAlt?.addEventListener('change', () => {
    applySecurityMode(securityAlt.checked);
  });
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

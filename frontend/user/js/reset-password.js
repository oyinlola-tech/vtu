import { api } from '/api/client.js';
import { showLoader, showBanner, initTheme } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  const email = sessionStorage.getItem('reset_email');
  const emailField = document.querySelector('[data-email]');
  if (emailField) emailField.textContent = email || '';
  const securityAnswerInput = document.querySelector('input[name=\"securityAnswer\"]');
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
    try {
      showLoader(true, 'Resetting password...');
      await api('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      sessionStorage.removeItem('reset_email');
      showBanner('Password reset successful', 'success');
      window.location.href = '/login';
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

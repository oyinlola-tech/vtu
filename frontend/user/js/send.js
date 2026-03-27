import { api } from '/api/client.js';
import { showLoader, showBanner, initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const form = document.querySelector('form');
  const transferRadios = document.querySelectorAll('input[name="transferType"]');
  const internalFields = document.querySelector('[data-internal-fields]');
  const bankFields = document.querySelectorAll('[data-bank-fields]');
  const bankSelect = document.querySelector('[data-bank-select]');
  const accountNumberInput = document.querySelector('input[name="accountNumber"]');
  const accountNameInput = document.querySelector('[data-account-name]');
  const accountStatus = document.querySelector('[data-account-status]');
  const internalToInput = document.querySelector('input[name="to"]');
  const securityAnswerInput = document.querySelector('input[name="securityAnswer"]');
  const securityQuestionText = document.querySelector('[data-security-question-text]');

  function setAccountStatus(text) {
    accountStatus.textContent = text;
  }

  function toggleFields(type) {
    const isBank = type === 'bank';
    internalFields.hidden = isBank;
    bankFields.forEach((el) => (el.hidden = !isBank));
    internalToInput.required = !isBank;
    accountNumberInput.required = isBank;
    bankSelect.required = isBank;
    accountNameInput.required = isBank;
    if (!isBank) {
      accountNumberInput.value = '';
      bankSelect.value = '';
      accountNameInput.value = '';
      setAccountStatus('');
    }
  }

  transferRadios.forEach((radio) => {
    radio.addEventListener('change', () => toggleFields(radio.value));
  });
  toggleFields('bank');

  async function loadBanks() {
    try {
      const banks = await api('/api/banks');
      bankSelect.innerHTML =
        '<option value=\"\">Select bank</option>' +
        banks.map((b) => `<option value=\"${b.code}\">${b.name}</option>`).join('');
    } catch (err) {
      bankSelect.innerHTML = '<option value=\"\">Unable to load banks</option>';
    }
  }

  async function resolveAccount() {
    const accountNumber = accountNumberInput.value.trim();
    const bankCode = bankSelect.value;
    if (!accountNumber || !bankCode) return;
    try {
      const result = await api('/api/banks/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      if (result.found) {
        accountNameInput.value = result.accountName || '';
        setAccountStatus(`Verified: ${result.bankName || 'Bank account'}`);
      } else {
        accountNameInput.value = '';
        setAccountStatus('Unable to verify this account. Please check details.');
      }
    } catch (err) {
      setAccountStatus(err.message);
    }
  }

  await loadBanks();
  accountNumberInput?.addEventListener('blur', resolveAccount);
  bankSelect?.addEventListener('change', resolveAccount);

  try {
    const question = await api('/api/user/security-question');
    if (question?.enabled && question.question) {
      if (securityQuestionText) {
        securityQuestionText.textContent = `Question: ${question.question}`;
      }
      if (securityAnswerInput) securityAnswerInput.required = true;
    } else if (securityQuestionText) {
      securityQuestionText.textContent = '';
    }
  } catch (err) {
    if (securityQuestionText) securityQuestionText.textContent = '';
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Sending money...');
      if (payload.transferType === 'bank') {
        if (!payload.accountName) throw new Error('Account not verified yet.');
        payload.channel = 'bank';
      } else {
        payload.channel = 'internal';
      }
      const result = await api('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showBanner(`${result.message}. Ref: ${result.reference}`, 'success');
      form.reset();
      accountNameInput.value = '';
      setAccountStatus('');
      toggleFields('bank');
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

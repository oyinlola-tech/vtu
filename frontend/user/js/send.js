import { api } from '/api/client.js';
import { showLoader, showBanner, initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const form = document.querySelector('[data-send-form]');
  const transferRadios = document.querySelectorAll('input[name="transferType"]');
  const internalFields = document.querySelector('[data-internal-fields]');
  const bankSelect = document.querySelector('[data-bank-select]');
  const accountNumberInput = document.querySelector('[data-account-number]');
  const accountNameInput = document.querySelector('[data-account-name]');
  const accountStatus = document.querySelector('[data-account-status]');
  const amountInput = document.querySelector('[data-amount]');
  const balanceText = document.querySelector('[data-balance-text]');
  const internalToInput = document.querySelector('input[name="to"]');
  const openPinBtn = document.querySelector('[data-open-pin]');
  const pinModal = document.querySelector('[data-pin-modal]');
  const pinInput = document.querySelector('[data-pin-input]');
  const pinHidden = document.querySelector('[data-pin-hidden]');
  const securityHidden = document.querySelector('[data-security-hidden]');
  const securityAnswerInput = document.querySelector('[data-security-answer]');
  const securityQuestionText = document.querySelector('[data-security-question-text]');
  const closePinBtn = document.querySelector('[data-close-pin]');
  const confirmPinBtn = document.querySelector('[data-confirm-pin]');
  const stepBank = document.querySelector('[data-step="bank"]');
  const stepName = document.querySelector('[data-step="name"]');
  const stepAmount = document.querySelector('[data-step="amount"]');

  let walletBalance = null;
  let accountResolved = false;

  function setAccountStatus(text) {
    if (accountStatus) accountStatus.textContent = text || '';
  }

  function show(el, visible) {
    if (!el) return;
    el.hidden = !visible;
  }

  function resetBankFlow() {
    accountResolved = false;
    setAccountStatus('');
    if (accountNameInput) accountNameInput.value = '';
    show(stepBank, false);
    show(stepName, false);
    show(stepAmount, false);
    if (openPinBtn) openPinBtn.disabled = true;
  }

  function updateBalanceText() {
    if (!balanceText) return;
    if (walletBalance == null) {
      balanceText.textContent = 'Balance unavailable. Connect wallet to validate limits.';
      return;
    }
    balanceText.textContent = `Available balance: NGN ${Number(walletBalance).toFixed(2)}`;
  }

  function validateAmount() {
    if (!amountInput) return false;
    const amount = Number(amountInput.value || 0);
    if (!amount || amount < 100) return false;
    if (walletBalance != null && amount > walletBalance) {
      setAccountStatus('Insufficient balance for this transfer.');
      return false;
    }
    return true;
  }

  function updateContinueState() {
    const canContinue = accountResolved && validateAmount();
    if (openPinBtn) openPinBtn.disabled = !canContinue;
  }

  function toggleFields(type) {
    const isBank = type === 'bank';
    show(internalFields, !isBank);
    if (internalToInput) internalToInput.required = !isBank;
    if (bankSelect) bankSelect.required = isBank;
    if (accountNumberInput) accountNumberInput.required = isBank;
    if (!isBank) {
      resetBankFlow();
      show(stepAmount, true);
      accountResolved = true;
      updateContinueState();
      return;
    }
    resetBankFlow();
    show(stepBank, accountNumberInput?.value?.trim().length >= 10);
  }

  transferRadios.forEach((radio) => {
    radio.addEventListener('change', () => toggleFields(radio.value));
  });
  toggleFields('bank');

  async function loadBanks() {
    try {
      const banks = await api('/api/banks');
      if (bankSelect) {
        bankSelect.innerHTML =
          '<option value="">Select bank</option>' +
          banks.map((b) => `<option value="${b.code}">${b.name}</option>`).join('');
      }
    } catch (err) {
      if (bankSelect) bankSelect.innerHTML = '<option value="">Unable to load banks</option>';
    }
  }

  async function resolveAccount() {
    const accountNumber = accountNumberInput?.value?.trim();
    const bankCode = bankSelect?.value;
    if (!accountNumber || !bankCode) return;
    try {
      const result = await api('/api/banks/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode }),
      });
      if (result.found) {
        if (accountNameInput) accountNameInput.value = result.accountName || '';
        setAccountStatus(`Verified: ${result.accountName || 'Account found'}`);
        accountResolved = true;
        show(stepAmount, true);
        updateContinueState();
      } else {
        if (accountNameInput) accountNameInput.value = '';
        setAccountStatus('Unable to verify this account. Please check details.');
        accountResolved = false;
        show(stepAmount, false);
        updateContinueState();
      }
    } catch (err) {
      setAccountStatus(err.message);
      accountResolved = false;
      show(stepAmount, false);
      updateContinueState();
    }
  }

  try {
    const wallet = await api('/api/wallet/balance');
    walletBalance = Number(wallet.balance || 0);
  } catch (err) {
    walletBalance = null;
  }
  updateBalanceText();

  await loadBanks();

  accountNumberInput?.addEventListener('input', () => {
    const digits = accountNumberInput.value.replace(/\D/g, '');
    accountNumberInput.value = digits;
    if (digits.length >= 10) {
      show(stepBank, true);
    } else {
      show(stepBank, false);
      show(stepName, false);
      show(stepAmount, false);
      accountResolved = false;
      updateContinueState();
    }
  });

  bankSelect?.addEventListener('change', async () => {
    show(stepName, true);
    await resolveAccount();
  });

  accountNumberInput?.addEventListener('blur', resolveAccount);

  amountInput?.addEventListener('input', () => {
    if (!validateAmount()) {
      updateContinueState();
      return;
    }
    setAccountStatus('');
    updateContinueState();
  });

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

  function openPinModal() {
    if (!pinModal) return;
    pinModal.hidden = false;
    if (pinInput) pinInput.focus();
  }

  function closePinModal() {
    if (!pinModal) return;
    pinModal.hidden = true;
    if (pinInput) pinInput.value = '';
    if (securityAnswerInput) securityAnswerInput.value = '';
  }

  openPinBtn?.addEventListener('click', () => {
    if (!validateAmount()) {
      showBanner('Enter a valid amount within your balance.', 'error');
      return;
    }
    openPinModal();
  });

  closePinBtn?.addEventListener('click', closePinModal);

  confirmPinBtn?.addEventListener('click', () => {
    const pinValue = pinInput?.value?.trim();
    if (!pinValue || pinValue.length < 4) {
      showBanner('Enter your transaction PIN to continue.', 'error');
      return;
    }
    if (pinHidden) pinHidden.value = pinValue;
    if (securityHidden && securityAnswerInput) {
      securityHidden.value = securityAnswerInput.value || '';
    }
    closePinModal();
    form?.requestSubmit();
  });

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
      if (walletBalance != null && Number(payload.amount) > walletBalance) {
        throw new Error('Insufficient balance for this transfer.');
      }
      const result = await api('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showBanner(`${result.message}. Ref: ${result.reference}`, 'success');
      form.reset();
      if (pinHidden) pinHidden.value = '';
      if (securityHidden) securityHidden.value = '';
      resetBankFlow();
      toggleFields('bank');
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

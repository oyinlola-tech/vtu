import { api } from '/api/client.js';
import { showLoader, showBanner, initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const form = document.querySelector('[data-bills-form]');
  const categorySelect = document.querySelector('[data-category]');
  const providerSelect = document.querySelector('[data-provider]');
  const accountInput = document.querySelector('input[name="account"]');
  const amountInput = document.querySelector('[data-amount]');
  const quoteBtn = document.querySelector('[data-quote-btn]');
  const quoteBox = document.querySelector('[data-quote]');
  const balanceText = document.querySelector('[data-balance-text]');
  const stepCount = document.querySelector('[data-step-count]');
  const stepBar = document.querySelector('[data-step-bar]');
  const providerSuggestions = document.querySelector('[data-provider-suggestions]');
  const openPinBtn = document.querySelector('[data-open-pin]');
  const pinModal = document.querySelector('[data-pin-modal]');
  const pinInput = document.querySelector('[data-pin-input]');
  const pinHidden = document.querySelector('[data-pin-hidden]');
  const closePinBtn = document.querySelector('[data-close-pin]');
  const confirmPinBtn = document.querySelector('[data-confirm-pin]');
  const stepProvider = document.querySelector('[data-step="provider"]');
  const stepAccount = document.querySelector('[data-step="account"]');
  const stepAmount = document.querySelector('[data-step="amount"]');

  let walletBalance = null;
  let stepIndex = 1;

  function show(el, visible) {
    if (!el) return;
    el.hidden = !visible;
  }

  function setStep(current, total) {
    stepIndex = current;
    if (stepCount) stepCount.textContent = `${current} of ${total}`;
    if (stepBar) stepBar.style.width = `${Math.min(100, (current / total) * 100)}%`;
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
      if (quoteBox) quoteBox.textContent = 'Insufficient balance for this payment.';
      return false;
    }
    return true;
  }

  function updateContinueState() {
    const canContinue =
      categorySelect?.value &&
      providerSelect?.value &&
      accountInput?.value?.trim() &&
      validateAmount();
    if (openPinBtn) openPinBtn.disabled = !canContinue;
  }

  try {
    const wallet = await api('/api/wallet/balance');
    walletBalance = Number(wallet.balance || 0);
  } catch (err) {
    walletBalance = null;
  }
  updateBalanceText();

  try {
    const categories = await api('/api/bills/categories');
    if (categorySelect) {
      categorySelect.innerHTML =
        '<option value=\"\">Select category</option>' +
        categories.map((c) => `<option value=\"${c.code}\">${c.name}</option>`).join('');
    }
  } catch (err) {
    console.error(err);
  }

  categorySelect?.addEventListener('change', async () => {
    const code = categorySelect.value;
    show(stepProvider, Boolean(code));
    show(stepAccount, false);
    show(stepAmount, false);
    show(quoteBtn, false);
    quoteBox.textContent = '';
    updateContinueState();
    setStep(code ? 2 : 1, 4);
    if (!code) return;
    const providers = await api(`/api/bills/providers?category=${code}`);
    if (providerSelect) {
      providerSelect.innerHTML =
        '<option value=\"\">Select provider</option>' +
        providers.map((p) => `<option value=\"${p.code}\">${p.name}</option>`).join('');
    }
    if (providerSuggestions) {
      const topProviders = providers.slice(0, 5);
      providerSuggestions.innerHTML = topProviders
        .map(
          (provider) =>
            `<button type=\"button\" data-provider-code=\"${provider.code}\">${provider.name}</button>`
        )
        .join('');
      providerSuggestions.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!providerSelect) return;
          providerSelect.value = btn.dataset.providerCode;
          show(stepAccount, true);
          setStep(3, 4);
          updateContinueState();
        });
      });
    }
  });

  providerSelect?.addEventListener('change', () => {
    const code = providerSelect.value;
    show(stepAccount, Boolean(code));
    show(stepAmount, false);
    show(quoteBtn, false);
    quoteBox.textContent = '';
    updateContinueState();
    setStep(code ? 3 : 2, 4);
  });

  accountInput?.addEventListener('input', () => {
    show(stepAmount, Boolean(accountInput.value.trim()));
    show(quoteBtn, Boolean(accountInput.value.trim()));
    updateContinueState();
    if (accountInput.value.trim()) setStep(4, 4);
  });

  amountInput?.addEventListener('input', () => {
    quoteBox.textContent = '';
    updateContinueState();
    if (amountInput.value) setStep(4, 4);
  });

  quoteBtn?.addEventListener('click', async () => {
    const providerCode = providerSelect?.value;
    const amount = amountInput?.value;
    if (!providerCode || !amount) return;
    try {
      const quote = await api('/api/bills/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCode, amount }),
      });
      quoteBox.textContent = `Fee NGN ${quote.fee.toFixed(2)} • Total NGN ${quote.total.toFixed(
        2
      )}`;
    } catch (err) {
      quoteBox.textContent = err.message;
    }
  });


  function openPinModal() {
    if (!pinModal) return;
    pinModal.hidden = false;
    if (pinInput) pinInput.focus();
  }

  function closePinModal() {
    if (!pinModal) return;
    pinModal.hidden = true;
    if (pinInput) pinInput.value = '';
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
    closePinModal();
    form?.requestSubmit();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Processing bill...');
      if (walletBalance != null && Number(payload.amount) > walletBalance) {
        throw new Error('Insufficient balance for this payment.');
      }
      const result = await api('/api/bills/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showBanner(`Bill paid. Ref: ${result.reference}`, 'success');
      form.reset();
      quoteBox.textContent = '';
      show(stepProvider, false);
      show(stepAccount, false);
      show(stepAmount, false);
      show(quoteBtn, false);
      if (pinHidden) pinHidden.value = '';
      updateContinueState();
      setStep(1, 4);
    } catch (err) {
      showBanner(err.message, 'error');
    } finally {
      showLoader(false);
    }
  });
});

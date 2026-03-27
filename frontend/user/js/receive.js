import { api } from '/api/client.js';
import { showLoader, showBanner, initTheme, initNav, ensureAuth } from '/js/ui.js';

function buildAccountQrPayload({ accountNumber, bankName }) {
  return `glyvtu://account?accountNumber=${encodeURIComponent(accountNumber)}&bank=${encodeURIComponent(
    bankName || ''
  )}`;
}

function buildRequestQrPayload({ accountNumber, bankName, amount, note }) {
  return `glyvtu://pay?accountNumber=${encodeURIComponent(accountNumber)}&bank=${encodeURIComponent(
    bankName || ''
  )}&amount=${encodeURIComponent(amount)}&note=${encodeURIComponent(note || '')}`;
}

function renderQr(container, payload) {
  container.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(container, {
    text: payload,
    width: 160,
    height: 160,
    colorDark: '#6b0f2e',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const accountNumberEl = document.querySelector('[data-account-number]');
  const bankNameEl = document.querySelector('[data-bank-name]');
  const accountQr = document.querySelector('[data-qr-account]');
  const requestQr = document.querySelector('[data-qr-request]');

  let accountNumber = '';
  let bankName = '';

  try {
    const profile = await api('/api/user/profile');
    accountNumber = profile.account_number || '';
    bankName = profile.bank_name || '';
    accountNumberEl.textContent = accountNumber || 'Not available yet';
    bankNameEl.textContent = bankName || '-';
    if (accountNumber) {
      renderQr(accountQr, buildAccountQrPayload({ accountNumber, bankName }));
    }
  } catch (err) {
    console.error(err);
  }

  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    if (!accountNumber) {
      showBanner('Reserved account not available yet.', 'error');
      return;
    }
    try {
      showLoader(true, 'Generating QR...');
      renderQr(
        requestQr,
        buildRequestQrPayload({
          accountNumber,
          bankName,
          amount: payload.amount,
          note: payload.note,
        })
      );
    } finally {
      showLoader(false);
    }
  });
});

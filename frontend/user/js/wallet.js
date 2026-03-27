import { api } from '/api/client.js';
import { initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  try {
    const wallet = await api('/api/wallet/balance');
    document.querySelector('[data-wallet-balance]').textContent = `NGN ${Number(
      wallet.balance
    ).toFixed(2)}`;
  } catch (err) {
    console.error(err);
  }
});

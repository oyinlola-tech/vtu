import { api } from '/api/client.js';
import { initTheme, initNav, ensureAuth } from '/js/ui.js';
import { renderTransactions } from '/js/render.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  try {
    const profile = await api('/api/user/profile');
    const wallet = await api('/api/wallet/balance');
    const transactions = await api('/api/transactions');
    document.querySelector('[data-user-name]').textContent = profile.full_name;
    document.querySelector('[data-wallet-balance]').textContent = `₦${Number(
      wallet.balance
    ).toFixed(2)}`;
    const accountNumber = document.querySelector('[data-account-number]');
    const accountBank = document.querySelector('[data-account-bank]');
    if (accountNumber && profile.account_number) {
      accountNumber.textContent = profile.account_number;
    }
    if (accountBank && profile.bank_name) {
      accountBank.textContent = `• ${profile.bank_name}`;
    }
    renderTransactions(transactions.slice(0, 5), document.querySelector('[data-transactions]'));
  } catch (err) {
    console.error(err);
  }
});

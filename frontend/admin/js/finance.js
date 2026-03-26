import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  try {
    const overview = await api('/api/admin/finance/overview');
    document.querySelector('[data-revenue]').textContent = `₦${Number(
      overview.revenue
    ).toFixed(2)}`;
    document.querySelector('[data-volume]').textContent = `₦${Number(
      overview.volume
    ).toFixed(2)}`;
    document.querySelector('[data-credits]').textContent = `₦${Number(
      overview.credits
    ).toFixed(2)}`;
    document.querySelector('[data-debits]').textContent = `₦${Number(
      overview.debits
    ).toFixed(2)}`;
    document.querySelector('[data-wallets]').textContent = `₦${Number(
      overview.walletBalance
    ).toFixed(2)}`;
    document.querySelector('[data-users]').textContent = overview.users;

    const balances = await api('/api/admin/finance/balances?limit=120');
    const table = document.querySelector('[data-balance-table]');
    table.innerHTML = balances
      .map(
        (b) => `
        <tr>
          <td>${b.full_name}</td>
          <td>${b.email}</td>
          <td>₦${Number(b.balance).toFixed(2)}</td>
          <td>${new Date(b.updated_at).toLocaleString()}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
});

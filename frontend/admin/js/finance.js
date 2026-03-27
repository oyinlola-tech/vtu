import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  try {
    const overview = await api('/api/admin/finance/overview');
    document.querySelector('[data-revenue]').textContent = `NGN ${Number(
      overview.revenue
    ).toFixed(2)}`;
    document.querySelector('[data-volume]').textContent = `NGN ${Number(
      overview.volume
    ).toFixed(2)}`;
    document.querySelector('[data-credits]').textContent = `NGN ${Number(
      overview.credits
    ).toFixed(2)}`;
    document.querySelector('[data-debits]').textContent = `NGN ${Number(
      overview.debits
    ).toFixed(2)}`;
    document.querySelector('[data-wallets]').textContent = `NGN ${Number(
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
          <td>NGN ${Number(b.balance).toFixed(2)}</td>
          <td>${new Date(b.updated_at).toLocaleString()}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    console.error(err);
  }

  const form = document.querySelector('[data-export-form]');
  const exportButtons = document.querySelectorAll('[data-export]');
  exportButtons.forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const params = new URLSearchParams();
      if (data.from) params.set('from', data.from);
      if (data.to) params.set('to', data.to);
      params.set('format', btn.dataset.export);
      window.location.href = `/api/admin/finance/export?${params.toString()}`;
    });
  });
});

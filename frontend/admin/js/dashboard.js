import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  try {
    const metrics = await api('/api/admin/transactions/metrics');
    const monnify = await api('/api/admin/monnify/metrics');
    document.querySelector('[data-users]').textContent = metrics.users;
    document.querySelector('[data-transactions]').textContent = metrics.transactions;
    document.querySelector('[data-volume]').textContent = `NGN ${Number(
      metrics.volume
    ).toFixed(2)}`;
    const failureEl = document.querySelector('[data-webhook-failure]');
    if (failureEl) {
      failureEl.textContent = `${Number(monnify.failureRate || 0).toFixed(1)}%`;
    }
  } catch (err) {
    console.error(err);
  }
});

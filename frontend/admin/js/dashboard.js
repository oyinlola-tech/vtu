import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  try {
    const metrics = await api('/api/admin/transactions/metrics');
    document.querySelector('[data-users]').textContent = metrics.users;
    document.querySelector('[data-transactions]').textContent = metrics.transactions;
    document.querySelector('[data-volume]').textContent = `₦${Number(metrics.volume).toFixed(
      2
    )}`;
  } catch (err) {
    console.error(err);
  }
});

import { api } from '/admin/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const table = document.querySelector('[data-monnify-table]');

  async function loadEvents(query = '') {
    const list = await api(`/api/admin/monnify/events?limit=120${query}`);
    table.innerHTML = list
      .map(
        (e) => `
        <tr>
          <td>${e.payment_reference}</td>
          <td>${e.account_reference || '-'}</td>
          <td>₦${Number(e.amount).toFixed(2)}</td>
          <td>${e.status}</td>
          <td>${e.attempts}</td>
          <td>${e.last_error || '-'}</td>
        </tr>`
      )
      .join('');
  }

  await loadEvents('');

  const filterForm = document.querySelector('[data-filter-form]');
  filterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(filterForm).entries());
    const params = new URLSearchParams();
    if (payload.status) params.set('status', payload.status);
    await loadEvents(`&${params.toString()}`);
  });

  const retryForm = document.querySelector('[data-retry-form]');
  retryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(retryForm).entries());
    try {
      showLoader(true, 'Scheduling retry...');
      await api('/api/admin/monnify/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Retry scheduled');
      retryForm.reset();
      await loadEvents('');
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

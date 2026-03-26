import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const table = document.querySelector('[data-table]');
  try {
    const list = await api('/api/admin/transactions');
    table.innerHTML = list
      .map(
        (t) => `
        <tr>
          <td>${t.full_name}</td>
          <td>${t.type}</td>
          <td>₦${Number(t.total).toFixed(2)}</td>
          <td>${t.status}</td>
          <td>${new Date(t.created_at).toLocaleString()}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
});

import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const table = document.querySelector('[data-audit-table]');
  try {
    const logs = await api('/api/admin/audit?limit=120');
    table.innerHTML = logs
      .map(
        (l) => `
        <tr>
          <td>${new Date(l.created_at).toLocaleString()}</td>
          <td>${l.actor_type}:${l.actor_id || '-'}</td>
          <td>${l.action}</td>
          <td>${l.entity_type || '-'}:${l.entity_id || '-'}</td>
          <td>${l.ip_address || '-'}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    console.error(err);
  }
});

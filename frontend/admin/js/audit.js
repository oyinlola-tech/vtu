import { api } from '/admin/api/client.js';
import { initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const table = document.querySelector('[data-audit-table]');
  async function loadLogs(query = '') {
    try {
      const logs = await api(`/api/admin/audit?limit=120${query}`);
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
  }

  await loadLogs('');

  const form = document.querySelector('[data-filter-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const params = new URLSearchParams();
    if (payload.from) params.set('from', payload.from);
    if (payload.to) params.set('to', payload.to);
    if (payload.actorType) params.set('actorType', payload.actorType);
    if (payload.actorId) params.set('actorId', payload.actorId);
    if (payload.action) params.set('action', payload.action);
    await loadLogs(`&${params.toString()}`);
  });
});

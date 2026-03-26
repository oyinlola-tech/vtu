import { api } from '/admin/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const table = document.querySelector('[data-table]');
  async function loadUsers() {
    try {
      const users = await api('/api/admin/users');
      table.innerHTML = users
        .map(
          (u) => `
          <tr>
            <td>${u.full_name}</td>
            <td>${u.email}</td>
            <td>${u.phone}</td>
            <td>${u.kyc_level}</td>
            <td>${u.kyc_status}</td>
          </tr>`
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }
  await loadUsers();

  const form = document.querySelector('[data-kyc-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Updating KYC...');
      await api(`/api/admin/users/${payload.userId}/kyc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: payload.status,
          level: Number(payload.level || 1),
        }),
      });
      alert('KYC updated');
      form.reset();
      await loadUsers();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

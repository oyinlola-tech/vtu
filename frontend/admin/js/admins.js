import { api } from '/admin/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();

  const table = document.querySelector('[data-admin-table]');
  const roleSelects = document.querySelectorAll('[data-role-select]');

  async function loadRoles() {
    const roles = await api('/api/admin/manage/roles');
    roleSelects.forEach((select) => {
      select.innerHTML = roles.map((r) => `<option value="${r}">${r}</option>`).join('');
    });
  }

  async function loadAdmins() {
    const admins = await api('/api/admin/manage');
    table.innerHTML = admins
      .map(
        (a) => `
        <tr>
          <td>${a.name}</td>
          <td>${a.email}</td>
          <td>${a.role}</td>
          <td>${new Date(a.created_at).toLocaleString()}</td>
        </tr>`
      )
      .join('');
  }

  await loadRoles();
  await loadAdmins();

  const form = document.querySelector('[data-admin-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Creating admin...');
      await api('/api/admin/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Admin created');
      form.reset();
      await loadAdmins();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });

  const roleForm = document.querySelector('[data-role-form]');
  roleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(roleForm).entries());
    try {
      showLoader(true, 'Updating role...');
      await api(`/api/admin/manage/${payload.adminId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: payload.role }),
      });
      alert('Role updated');
      roleForm.reset();
      await loadAdmins();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

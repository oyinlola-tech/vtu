import { api } from '/admin/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const categoriesTable = document.querySelector('[data-categories]');
  const providersTable = document.querySelector('[data-providers]');

  async function loadBills() {
    try {
      const categories = await api('/api/admin/bills/categories');
      categoriesTable.innerHTML = categories
        .map(
          (c) => `
          <tr>
            <td>${c.name}</td>
            <td>${c.code}</td>
            <td>${c.active ? 'Active' : 'Disabled'}</td>
          </tr>`
        )
        .join('');

      const providers = await api('/api/admin/bills/providers');
      providersTable.innerHTML = providers
        .map(
          (p) => `
          <tr>
            <td>${p.name}</td>
            <td>${p.code}</td>
            <td>${p.category_name}</td>
            <td>${p.active ? 'Active' : 'Disabled'}</td>
          </tr>`
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  await loadBills();

  const catForm = document.querySelector('[data-category-form]');
  catForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(catForm).entries());
    try {
      showLoader(true, 'Creating category...');
      await api('/api/admin/bills/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Category created');
      catForm.reset();
      await loadBills();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });

  const providerForm = document.querySelector('[data-provider-form]');
  providerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(providerForm).entries());
    try {
      showLoader(true, 'Creating provider...');
      await api('/api/admin/bills/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Provider created');
      providerForm.reset();
      await loadBills();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

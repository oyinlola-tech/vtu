import { api } from '/admin/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/admin/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const table = document.querySelector('[data-pricing]');

  async function loadPricing() {
    try {
      const pricing = await api('/api/admin/bills/pricing');
      table.innerHTML = pricing
        .map(
          (p) => `
          <tr>
            <td>${p.provider}</td>
            <td>${p.base_fee}</td>
            <td>${p.markup_type}</td>
            <td>${p.markup_value}</td>
            <td>${p.active ? 'Active' : 'Disabled'}</td>
          </tr>`
        )
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  await loadPricing();

  const form = document.querySelector('[data-pricing-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Updating pricing...');
      await api(`/api/admin/bills/pricing/${payload.pricingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseFee: Number(payload.baseFee || 0),
          markupType: payload.markupType,
          markupValue: Number(payload.markupValue || 0),
          currency: payload.currency || 'NGN',
          active: payload.active === 'on',
        }),
      });
      alert('Pricing updated');
      form.reset();
      await loadPricing();
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

import { api } from '/api/client.js';
import { showLoader, initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const categorySelect = document.querySelector('[data-category]');
  const providerSelect = document.querySelector('[data-provider]');
  const quoteBox = document.querySelector('[data-quote]');

  try {
    const categories = await api('/api/bills/categories');
    categorySelect.innerHTML =
      '<option value=\"\">Select category</option>' +
      categories.map((c) => `<option value=\"${c.code}\">${c.name}</option>`).join('');
  } catch (err) {
    console.error(err);
  }

  categorySelect?.addEventListener('change', async () => {
    const code = categorySelect.value;
    if (!code) return;
    const providers = await api(`/api/bills/providers?category=${code}`);
    providerSelect.innerHTML =
      '<option value=\"\">Select provider</option>' +
      providers.map((p) => `<option value=\"${p.code}\">${p.name}</option>`).join('');
  });

  const quoteBtn = document.querySelector('[data-quote-btn]');
  quoteBtn?.addEventListener('click', async () => {
    const providerCode = providerSelect.value;
    const amount = document.querySelector('[data-amount]').value;
    try {
      const quote = await api('/api/bills/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCode, amount }),
      });
      quoteBox.textContent = `Fee NGN ${quote.fee.toFixed(2)} • Total NGN ${quote.total.toFixed(2)}`;
    } catch (err) {
      quoteBox.textContent = err.message;
    }
  });

  const form = document.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      showLoader(true, 'Processing bill...');
      const result = await api('/api/bills/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert(`Bill paid. Ref: ${result.reference}`);
      form.reset();
      quoteBox.textContent = '';
    } catch (err) {
      alert(err.message);
    } finally {
      showLoader(false);
    }
  });
});

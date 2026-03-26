import { api } from '/api/client.js';
import { initTheme, initNav, ensureAuth } from '/js/ui.js';
import { renderTransactions } from '/js/render.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  try {
    const list = await api('/api/transactions');
    renderTransactions(list, document.querySelector('[data-transactions]'));
  } catch (err) {
    console.error(err);
  }
});

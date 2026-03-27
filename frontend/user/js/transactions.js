import { api, apiBase, getToken, getCsrfToken } from '/api/client.js';
import { initTheme, initNav, ensureAuth, showLoader, showBanner } from '/js/ui.js';
import { renderTransactions } from '/js/render.js';

function toDateInput(value) {
  return value.toISOString().slice(0, 10);
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initNav();
  ensureAuth();
  const form = document.querySelector('[data-statement-form]');
  if (form) {
    const startInput = form.querySelector('input[name="startDate"]');
    const endInput = form.querySelector('input[name="endDate"]');
    const downloadBtn = form.querySelector('[data-statement-download]');
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    if (startInput && !startInput.value) startInput.value = toDateInput(thirtyDaysAgo);
    if (endInput && !endInput.value) endInput.value = toDateInput(today);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const startDate = startInput?.value;
      const endDate = endInput?.value;
      if (!startDate || !endDate) {
        showBanner('Please select a start and end date.', 'error');
        return;
      }
      if (startDate > endDate) {
        showBanner('Start date must be before end date.', 'error');
        return;
      }
      try {
        showLoader(true, 'Sending statement...');
        await api('/api/transactions/statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate }),
        });
        showBanner('Statement sent to your email.', 'success');
      } catch (err) {
        console.error(err);
        showBanner(err.message || 'Unable to send statement.', 'error');
      } finally {
        showLoader(false);
      }
    });

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const startDate = startInput?.value;
        const endDate = endInput?.value;
        if (!startDate || !endDate) {
          showBanner('Please select a start and end date.', 'error');
          return;
        }
        if (startDate > endDate) {
          showBanner('Start date must be before end date.', 'error');
          return;
        }
        try {
          showLoader(true, 'Preparing download...');
          const headers = { 'Content-Type': 'application/json' };
          const token = getToken();
          if (token) headers.Authorization = `Bearer ${token}`;
          const csrfToken = getCsrfToken();
          if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
          const response = await fetch(`${apiBase}/api/transactions/statement/download`, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ startDate, endDate }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || 'Download failed');
          }
          const blob = await response.blob();
          const disposition = response.headers.get('Content-Disposition') || '';
          const match = /filename="([^"]+)"/.exec(disposition);
          const filename =
            match?.[1] || `glyvtu-statement-${startDate}-to-${endDate}.pdf`;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          showBanner('Statement downloaded.', 'success');
        } catch (err) {
          console.error(err);
          showBanner(err.message || 'Unable to download statement.', 'error');
        } finally {
          showLoader(false);
        }
      });
    }
  }
  try {
    const list = await api('/api/transactions');
    renderTransactions(list, document.querySelector('[data-transactions]'));
  } catch (err) {
    console.error(err);
  }
});

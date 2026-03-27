import { initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  ensureAuth();

  const items = Array.from(document.querySelectorAll('.faq-item'));
  const searchInput = document.querySelector('#faq-search');
  const countEl = document.querySelector('[data-faq-count]');

  function updateCount(visibleCount) {
    if (!countEl) return;
    if (visibleCount === 0) {
      countEl.textContent = 'No matching answers found. Try different keywords.';
      return;
    }
    countEl.textContent = `${visibleCount} result${visibleCount === 1 ? '' : 's'} found.`;
  }

  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.removeAttribute('open');
      });
    });
  });

  if (searchInput) {
    const originalOpen = new Set(items.filter((item) => item.open));
    updateCount(items.length);

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      let visible = 0;

      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        const match = text.includes(query);
        item.hidden = !match;
        if (match) {
          visible += 1;
          if (query && !item.open) item.setAttribute('open', '');
          if (!query && !originalOpen.has(item)) item.removeAttribute('open');
        }
      });

      updateCount(visible);
    });
  }
});

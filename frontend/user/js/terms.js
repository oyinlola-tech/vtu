import { initTheme, initNav, ensureAuth } from '/js/ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  ensureAuth();
});

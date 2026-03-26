import { getToken } from '/admin/api/client.js';

const protectedPages = new Set([
  'dashboard',
  'finance',
  'users',
  'admins',
  'bills',
  'pricing',
  'transactions',
  'settings',
  'audit',
]);

function showLoader(show, text = 'Processing...') {
  const overlay = document.querySelector('.overlay');
  if (!overlay) return;
  overlay.classList.toggle('show', show);
  const label = overlay.querySelector('[data-loader-text]');
  if (label) label.textContent = text;
}

function initTheme() {
  const stored = localStorage.getItem('gly_vtu_admin_theme') || 'light';
  document.documentElement.setAttribute('data-theme', stored);
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.textContent = stored === 'dark' ? 'Light Mode' : 'Dark Mode';
    toggle.addEventListener('click', () => {
      const next = stored === 'dark' ? 'light' : 'dark';
      localStorage.setItem('gly_vtu_admin_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      toggle.textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
  }
}

function initNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll('.nav-link').forEach((link) => {
    if (link.dataset.page === page) link.classList.add('active');
  });
}

function ensureAuth() {
  const page = document.body.dataset.page;
  if (!protectedPages.has(page)) return;
  if (!getToken()) {
    window.location.href = '/admin/login';
  }
}

export { showLoader, initTheme, initNav, ensureAuth };

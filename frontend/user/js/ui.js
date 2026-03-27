import { getToken } from '/api/client.js';

const protectedPages = new Set([
  'dashboard',
  'wallet',
  'send',
  'receive',
  'bills',
  'transactions',
  'kyc',
  'settings',
]);

function showLoader(show, text = 'Processing...') {
  const overlay = document.querySelector('.overlay');
  if (!overlay) return;
  overlay.classList.toggle('show', show);
  const label = overlay.querySelector('[data-loader-text]');
  if (label) label.textContent = text;
}

function showBanner(message, type = 'success', timeout = 4000) {
  let container = document.querySelector('[data-banner]');
  if (!container) {
    container = document.createElement('div');
    container.setAttribute('data-banner', '');
    container.className = 'banner';
    document.body.appendChild(container);
  }
  container.textContent = message;
  container.classList.remove('success', 'error');
  container.classList.add(type);
  container.classList.add('show');
  window.clearTimeout(container._timer);
  container._timer = window.setTimeout(() => {
    container.classList.remove('show');
  }, timeout);
}

function initReveal() {
  const items = Array.from(document.querySelectorAll('.hero, .card, .table'));
  items.forEach((el, idx) => {
    el.classList.add('reveal');
    window.setTimeout(() => el.classList.add('show'), 80 + idx * 60);
  });
}

function initStagger() {
  const groups = [];

  document.querySelectorAll('.stagger').forEach((group) => {
    groups.push(Array.from(group.children));
  });

  document.querySelectorAll('.table tbody').forEach((tbody) => {
    groups.push(Array.from(tbody.querySelectorAll('tr')));
  });

  document.querySelectorAll('.grid').forEach((grid) => {
    const cards = Array.from(grid.querySelectorAll('.card'));
    if (cards.length) groups.push(cards);
  });

  groups.forEach((items) => {
    items.forEach((item, idx) => {
      if (item.classList.contains('show')) return;
      item.classList.add('stagger-item');
      window.setTimeout(() => item.classList.add('show'), 140 + idx * 70);
    });
  });
}

function initTheme() {
  const stored = localStorage.getItem('gly_vtu_theme') || 'light';
  document.documentElement.setAttribute('data-theme', stored);
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.textContent = stored === 'dark' ? 'Light Mode' : 'Dark Mode';
    toggle.addEventListener('click', () => {
      const next = stored === 'dark' ? 'light' : 'dark';
      localStorage.setItem('gly_vtu_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      toggle.textContent = next === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
  }
  document.body.classList.add('page-loaded');
  initReveal();
  initStagger();
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
    window.location.href = '/login';
  }
}

export { showLoader, showBanner, initTheme, initNav, ensureAuth };

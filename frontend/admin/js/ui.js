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

function isDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function isDevBypassEnabled() {
  const params = new URLSearchParams(window.location.search);
  return params.get('dev') === 'true';
}

async function initDevBanner() {
  if (!isDevHost()) return;
  try {
    const res = await fetch('/dev-status', { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.dbReady === false) {
      showBanner('DB not connected (dev mode). UI only.', 'error', 8000);
    }
  } catch (err) {
    // Ignore dev status errors to avoid blocking UI.
  }
}

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
  const stored = localStorage.getItem('gly_vtu_admin_theme') || 'light';
  let current = stored;
  document.documentElement.setAttribute('data-theme', current);
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    const label = current === 'dark' ? 'Light Mode' : 'Dark Mode';
    toggle.innerHTML = `<i class="fa-solid fa-circle-half-stroke"></i>${label}`;
    toggle.addEventListener('click', () => {
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem('gly_vtu_admin_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      const nextLabel = next === 'dark' ? 'Light Mode' : 'Dark Mode';
      toggle.innerHTML = `<i class="fa-solid fa-circle-half-stroke"></i>${nextLabel}`;
      current = next;
    });
  }
  document.body.classList.add('page-loaded');
  initReveal();
  initStagger();
  initDevBanner();
  updateUserBadge();
}

function getInitials(name) {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AD';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function updateUserBadge() {
  const nameEls = Array.from(document.querySelectorAll('[data-user-name]'));
  const nameEl = nameEls.find((el) => el.textContent && el.textContent.trim() !== '');
  if (!nameEl) return;
  const name = nameEl.textContent.trim();
  const avatar = document.querySelector('.sidebar-profile .avatar');
  const profileName = document.querySelector('.sidebar-profile .name');
  if (avatar) avatar.textContent = getInitials(name);
  if (profileName) profileName.textContent = name;
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
  if (isDevHost() && isDevBypassEnabled()) return;
  if (!getToken()) {
    window.location.href = '/admin/login';
  }
}

export { showLoader, showBanner, initTheme, initNav, ensureAuth };

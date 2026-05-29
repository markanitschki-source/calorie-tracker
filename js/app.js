import { renderDashboard }  from './views/dashboard.js';
import { renderFoodLog }    from './views/foodlog.js';
import { renderRecipes }    from './views/recipes.js';
import { renderShopping }   from './views/shopping.js';
import { renderSettings }   from './views/settings.js';

const views = {
  dashboard: renderDashboard,
  log:       renderFoodLog,
  recipes:   renderRecipes,
  shopping:  renderShopping,
  settings:  renderSettings,
};

let currentView = 'dashboard';

// ── Router ────────────────────────────────────────────────
export async function navigate(view) {
  if (!views[view]) view = 'dashboard';
  currentView = view;

  const container = document.getElementById('view-container');
  container.scrollTop = 0;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  await views[view](container);

  history.replaceState(null, '', `#${view}`);
}

// ── Modal ─────────────────────────────────────────────────
export function openModal(renderFn) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = '<div class="modal-handle"></div>';
  renderFn(box);
  overlay.classList.remove('hidden');

  const close = (e) => {
    if (e.target === overlay) closeModal();
  };
  overlay.addEventListener('click', close, { once: true });
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
}

// ── Toast ─────────────────────────────────────────────────
let toastTimer;
export function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  const hash = location.hash.slice(1);
  await navigate(views[hash] ? hash : 'dashboard');
});

// Re-render current view (called by sub-views after data changes)
export function refresh() {
  navigate(currentView);
}

export const VERSION = '1.9.0';

import { renderDashboard }  from './views/dashboard.js';
import { renderFoodLog }    from './views/foodlog.js';
import { renderRecipes }    from './views/recipes.js';
import { renderShopping }   from './views/shopping.js';
import { renderWeekplan }   from './views/weekplan.js';
import { renderBody }       from './views/body.js';
import { renderSettings }   from './views/settings.js';
import { initDB, migrateV4, getProfiles, getActiveProfileId, switchProfile } from './db.js';

const views = {
  dashboard: renderDashboard,
  log:       renderFoodLog,
  recipes:   renderRecipes,
  shopping:  renderShopping,
  weekplan:  renderWeekplan,
  body:      renderBody,
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
  const box     = document.getElementById('modal-box');
  box.innerHTML = '<div class="modal-handle"></div>';
  renderFn(box);
  overlay.classList.remove('hidden');
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); }, { once: true });
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

// ── Profile Switcher ──────────────────────────────────────
async function initProfileSwitcher() {
  const btn     = document.getElementById('profile-btn');
  const panel   = document.getElementById('profile-panel');
  const overlay = document.getElementById('profile-overlay');
  if (!btn || !panel) return;

  const updateBtn = async () => {
    const profiles = await getProfiles();
    if (profiles.length <= 1) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    const active   = profiles.find(p => p.id === getActiveProfileId()) ?? profiles[0];
    if (active) {
      btn.textContent     = active.emoji;
      btn.title           = active.name;
      btn.style.background = active.color + '22';
      btn.style.borderColor = active.color + '66';
    }
  };

  const closePanel = () => {
    panel.classList.remove('open');
    overlay.classList.add('hidden');
  };

  const openPanel = async () => {
    const profiles = await getProfiles();
    const pid      = getActiveProfileId();
    panel.innerHTML = profiles.map(p => `
      <button class="profile-item ${p.id === pid ? 'active' : ''}" data-pid="${p.id}" style="--pc:${p.color}">
        <span class="profile-item-emoji">${p.emoji}</span>
        <span class="profile-item-name">${p.name}</span>
        ${p.id === pid ? '<span class="profile-item-check">✓</span>' : ''}
      </button>`).join('');
    panel.classList.add('open');
    overlay.classList.remove('hidden');

    panel.querySelectorAll('.profile-item').forEach(item => {
      item.addEventListener('click', async () => {
        await switchProfile(item.dataset.pid);
        await updateBtn();
        closePanel();
        navigate(currentView);
      });
    });
  };

  btn.addEventListener('click', () =>
    panel.classList.contains('open') ? closePanel() : openPanel()
  );
  overlay.addEventListener('click', closePanel);

  await updateBtn();
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  await migrateV4();

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.register('./sw.js').catch(() => null);
    if (reg) {
      const notifyUpdate = () => {
        if (reg.waiting) {
          const toast = document.getElementById('toast');
          toast.innerHTML = 'Update verfügbar — <strong style="cursor:pointer;text-decoration:underline" id="sw-reload">Neu laden</strong>';
          toast.classList.add('visible');
          document.getElementById('sw-reload')?.addEventListener('click', () => {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
          });
        }
      };
      reg.addEventListener('updatefound', () => {
        reg.installing?.addEventListener('statechange', e => {
          if (e.target.state === 'installed') notifyUpdate();
        });
      });
      if (reg.waiting) notifyUpdate();
    }
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  await initProfileSwitcher();

  const hash = location.hash.slice(1);
  await navigate(views[hash] ? hash : 'dashboard');
});

export function refresh() {
  navigate(currentView);
}

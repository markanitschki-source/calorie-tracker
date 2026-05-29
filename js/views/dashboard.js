import { getTodayLog, sumLog, sumByMeal, entriesByMeal, getWeekLogs, getSettings, removeFoodEntry } from '../db.js';
import { navigate, showToast, refresh } from '../app.js';

const RING_R    = 75;
const RING_CIRC = 2 * Math.PI * RING_R;

const MEALS = [
  { key: 'fruehstueck', label: 'Frühstück',   icon: '🌅', pct: 0.25 },
  { key: 'mittagessen', label: 'Mittagessen',  icon: '☀️', pct: 0.35 },
  { key: 'abendessen',  label: 'Abendessen',   icon: '🌙', pct: 0.30 },
  { key: 'snack',       label: 'Snacks',       icon: '🍎', pct: 0.10 },
];

function dateLabel() {
  const d      = new Date();
  const days   = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}

function ringOffset(consumed, goal) {
  return RING_CIRC * (1 - Math.min(consumed / goal, 1));
}

function ringClass(consumed, goal) {
  const p = consumed / goal;
  if (p >= 1)    return 'over';
  if (p >= 0.85) return 'near';
  if (p >= 0.4)  return 'good';
  return '';
}

function macroBar(value, max) {
  const pct = Math.min(value / max * 100, 100);
  return `<div class="m-bar"><div class="m-bar-fill" style="width:${pct}%"></div></div>`;
}

function entryKcal(e) {
  return Math.round((e.kcal_100g ?? e.kcal ?? 0) * (e.amount ?? 100) / 100);
}

export async function renderDashboard(container) {
  const [log, settings, weekLogs] = await Promise.all([
    getTodayLog(), getSettings(), getWeekLogs(),
  ]);

  const totals      = sumLog(log);
  const byMeal      = entriesByMeal(log);
  const mealKcal    = sumByMeal(log);
  const totalBudget = settings.dailyGoal + (settings.activityKcal ?? 0);
  const remaining   = totalBudget - totals.kcal;
  const proteinGoal = Math.round(totalBudget * 0.25 / 4);
  const carbsGoal   = Math.round(totalBudget * 0.50 / 4);
  const fatGoal     = Math.round(totalBudget * 0.25 / 9);

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Dashboard</h1>
        <div class="subtitle">${dateLabel()}</div>
      </div>
    </header>

    <!-- Kalorienring -->
    <div class="calorie-ring-wrap">
      <div class="ring-container">
        <svg class="calorie-ring" viewBox="0 0 170 170">
          <circle class="ring-bg"   cx="85" cy="85" r="${RING_R}"/>
          <circle class="ring-fill ${ringClass(totals.kcal, totalBudget)}"
            cx="85" cy="85" r="${RING_R}"
            stroke-dasharray="${RING_CIRC.toFixed(1)}"
            stroke-dashoffset="${ringOffset(totals.kcal, totalBudget).toFixed(1)}"/>
        </svg>
        <div class="ring-center">
          <div class="kcal-value">${Math.round(totals.kcal)}</div>
          <div class="kcal-label">kcal getrackt</div>
          <div class="kcal-remaining" style="color:${remaining < 0 ? 'var(--red)' : 'var(--text-2)'}">
            ${remaining >= 0
              ? `noch ${Math.round(remaining)} kcal`
              : `${Math.abs(Math.round(remaining))} kcal drüber`}
          </div>
        </div>
      </div>
      <div class="day-dot-row">
        ${weekLogs.map((d, i) => {
          const isToday = i === 6;
          const hasData = d.sum.kcal > 50;
          return `<div class="day-dot ${isToday ? 'today' : hasData ? 'filled' : ''}"></div>`;
        }).join('')}
      </div>
    </div>

    <!-- Makros -->
    <div class="macro-row">
      <div class="macro-card macro-protein">
        <div class="m-value">${Math.round(totals.protein)}g</div>
        <div class="m-label">Protein</div>
        ${macroBar(totals.protein, proteinGoal)}
      </div>
      <div class="macro-card macro-carbs">
        <div class="m-value">${Math.round(totals.carbs)}g</div>
        <div class="m-label">Kohlenhydrate</div>
        ${macroBar(totals.carbs, carbsGoal)}
      </div>
      <div class="macro-card macro-fat">
        <div class="m-value">${Math.round(totals.fat)}g</div>
        <div class="m-label">Fett</div>
        ${macroBar(totals.fat, fatGoal)}
      </div>
    </div>

    <!-- Mahlzeiten-Übersicht -->
    <div class="section">
      <div class="section-label">Tagesübersicht</div>
      ${MEALS.map(m => {
        const target   = Math.round(totalBudget * m.pct);
        const consumed = mealKcal[m.key] ?? 0;
        const entries  = byMeal[m.key] ?? [];
        const pct      = Math.min(consumed / target * 100, 100);
        const over     = consumed > target;
        return `
        <div class="meal-section card" style="margin-bottom:10px">
          <div class="meal-header" data-meal="${m.key}" style="cursor:pointer">
            <div style="display:flex;align-items:center;gap:10px;padding:12px 14px">
              <span style="font-size:20px">${m.icon}</span>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:600">${m.label}</div>
                <div style="height:4px;background:var(--surface-3);border-radius:2px;margin-top:5px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${over ? 'var(--red)' : 'var(--accent)'};border-radius:2px;transition:width 0.5s ease"></div>
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:15px;font-weight:700;color:${over ? 'var(--red)' : 'var(--accent)'}">
                  ${consumed} <span style="font-size:11px;font-weight:400;color:var(--text-3)">/ ${target}</span>
                </div>
                <div style="font-size:11px;color:var(--text-3)">kcal</div>
              </div>
            </div>
          </div>
          <div class="meal-entries" id="entries-${m.key}" style="${entries.length === 0 ? 'display:none' : ''}">
            ${entries.map(e => entryRow(e)).join('')}
          </div>
          <div style="padding:6px 14px 10px">
            <button class="btn btn-ghost btn-sm" data-add-meal="${m.key}" style="width:100%;font-size:13px">
              + ${m.label} hinzufügen
            </button>
          </div>
        </div>`;
      }).join('')}

      ${(byMeal.unset?.length ?? 0) > 0 ? `
      <div class="card" style="margin-bottom:10px">
        <div style="padding:10px 14px 4px">
          <div style="font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px">Ohne Kategorie</div>
        </div>
        ${byMeal.unset.map(e => entryRow(e)).join('')}
      </div>` : ''}
    </div>

    <!-- Ziel-Info -->
    <div class="section">
      <div class="section-label">Tagesziel</div>
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="background:var(--accent-dim);color:var(--accent)">🎯</div>
          <div class="card-body">
            <div class="card-title">${totalBudget} kcal gesamt</div>
            <div class="card-subtitle">
              ${settings.dailyGoal} Basis
              ${settings.activityKcal ? ` + ${settings.activityKcal} Aktivität` : ''}
            </div>
          </div>
          <div class="card-right">
            <div class="card-kcal">${Math.round(totals.kcal / totalBudget * 100)}%</div>
            <div class="card-kcal-label">erreicht</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Mahlzeit-Header togglet Einträge
  container.querySelectorAll('.meal-header').forEach(h => {
    h.addEventListener('click', () => {
      const key  = h.dataset.meal;
      const list = container.querySelector(`#entries-${key}`);
      if (list) list.style.display = list.style.display === 'none' ? '' : 'none';
    });
  });

  // "+ X hinzufügen" → Tracken-Tab mit vorausgewählter Mahlzeit
  container.querySelectorAll('[data-add-meal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window._preselectedMeal = btn.dataset.addMeal;
      navigate('log');
    });
  });

  // Eintrag löschen
  container.querySelectorAll('.entry-del').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await removeFoodEntry(Number(btn.dataset.id));
      showToast('Eintrag gelöscht');
      refresh();
    });
  });
}

function entryRow(e) {
  const kcal    = entryKcal(e);
  const protein = ((e.protein_100g ?? 0) * (e.amount ?? 100) / 100).toFixed(1);
  const carbs   = ((e.carbs_100g   ?? 0) * (e.amount ?? 100) / 100).toFixed(1);
  const fat     = ((e.fat_100g     ?? 0) * (e.amount ?? 100) / 100).toFixed(1);

  return `
    <div class="entry-item">
      <div class="entry-body">
        <div class="entry-name">${escHtml(e.name)}</div>
        <div class="entry-meta">${e.amount ?? 100}g · P${protein} K${carbs} F${fat}</div>
      </div>
      <div class="entry-kcal">${kcal} kcal</div>
      <button class="entry-del" data-id="${e.id}" title="Löschen">✕</button>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

import { getTodayLog, sumLog, getWeekLogs, getSettings, removeFoodEntry } from '../db.js';
import { navigate, showToast, refresh } from '../app.js';

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const RING_R = 75;
const RING_CIRC = 2 * Math.PI * RING_R;

function dateLabel() {
  const d = new Date();
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}

function ringOffset(consumed, goal) {
  const pct = Math.min(consumed / goal, 1);
  return RING_CIRC * (1 - pct);
}

function ringColor(consumed, goal) {
  const pct = consumed / goal;
  if (pct >= 1)    return 'over';
  if (pct >= 0.85) return 'near';
  if (pct >= 0.4)  return 'good';
  return '';
}

function macroBar(value, max) {
  const pct = Math.min(value / max * 100, 100);
  return `<div class="m-bar"><div class="m-bar-fill" style="width:${pct}%"></div></div>`;
}

export async function renderDashboard(container) {
  const [log, settings, weekLogs] = await Promise.all([
    getTodayLog(),
    getSettings(),
    getWeekLogs(),
  ]);

  const totals = sumLog(log);
  const goal   = settings.dailyGoal;
  const offset = ringOffset(totals.kcal, goal);
  const color  = ringColor(totals.kcal, goal);
  const remaining = goal - totals.kcal;

  const proteinGoal = Math.round(goal * 0.25 / 4);
  const carbsGoal   = Math.round(goal * 0.50 / 4);
  const fatGoal     = Math.round(goal * 0.25 / 9);

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Dashboard</h1>
        <div class="subtitle">${dateLabel()}</div>
      </div>
    </header>

    <!-- Calorie Ring -->
    <div class="calorie-ring-wrap">
      <div class="ring-container">
        <svg class="calorie-ring" viewBox="0 0 170 170">
          <circle class="ring-bg" cx="85" cy="85" r="${RING_R}"/>
          <circle class="ring-fill ${color}" cx="85" cy="85" r="${RING_R}"
            stroke-dasharray="${RING_CIRC.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}"/>
        </svg>
        <div class="ring-center">
          <div class="kcal-value">${totals.kcal.toFixed(0)}</div>
          <div class="kcal-label">kcal gegessen</div>
          <div class="kcal-remaining" style="color:${remaining < 0 ? 'var(--red)' : 'var(--text-2)'}">
            ${remaining >= 0
              ? `noch ${remaining.toFixed(0)} kcal`
              : `${Math.abs(remaining).toFixed(0)} kcal drüber`}
          </div>
        </div>
      </div>

      <!-- Week dots -->
      <div class="day-dot-row" title="Letzte 7 Tage">
        ${weekLogs.map((d, i) => {
          const isToday = i === 6;
          const hasData = d.sum.kcal > 50;
          return `<div class="day-dot ${isToday ? 'today' : hasData ? 'filled' : ''}" title="${d.date}"></div>`;
        }).join('')}
      </div>
    </div>

    <!-- Macros -->
    <div class="macro-row">
      <div class="macro-card macro-protein">
        <div class="m-value">${totals.protein.toFixed(0)}g</div>
        <div class="m-label">Protein</div>
        ${macroBar(totals.protein, proteinGoal)}
      </div>
      <div class="macro-card macro-carbs">
        <div class="m-value">${totals.carbs.toFixed(0)}g</div>
        <div class="m-label">Kohlenhydrate</div>
        ${macroBar(totals.carbs, carbsGoal)}
      </div>
      <div class="macro-card macro-fat">
        <div class="m-value">${totals.fat.toFixed(0)}g</div>
        <div class="m-label">Fett</div>
        ${macroBar(totals.fat, fatGoal)}
      </div>
    </div>

    <!-- Today's Entries -->
    <div class="section">
      <div class="section-label">Heute gegessen</div>
      ${log.entries.length === 0
        ? `<div class="empty-state">
            <div class="empty-icon">🍽️</div>
            <p>Noch nichts getrackt.<br>Tippe auf „Tracken" um anzufangen.</p>
          </div>`
        : `<div class="card" id="entry-list">
            ${log.entries.map(e => entryRow(e)).join('')}
          </div>`}
    </div>

    ${log.entries.length > 0 ? `
    <div class="section" style="padding-top:0">
      <button class="btn btn-ghost btn-sm" id="btn-add-more" style="width:100%">
        + Weitere Mahlzeit tracken
      </button>
    </div>` : ''}

    <!-- Ziel-Info -->
    <div class="section">
      <div class="section-label">Tagesziel</div>
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="background:var(--accent-dim);color:var(--accent)">🎯</div>
          <div class="card-body">
            <div class="card-title">${goal} kcal / Tag</div>
            <div class="card-subtitle">Ziel in Einstellungen ändern</div>
          </div>
          <div class="card-right">
            <div class="card-kcal">${Math.round(totals.kcal / goal * 100)}%</div>
            <div class="card-kcal-label">erreicht</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Events
  container.querySelectorAll('.entry-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      await removeFoodEntry(id);
      showToast('Eintrag gelöscht');
      refresh();
    });
  });

  container.querySelector('#btn-add-more')?.addEventListener('click', () => navigate('log'));
}

function entryRow(e) {
  const kcal = Math.round((e.kcal_100g ?? e.kcal ?? 0) * (e.amount ?? 100) / 100);
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

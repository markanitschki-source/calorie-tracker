import {
  getTodayLog, sumLog, sumByMeal, entriesByMeal, getWeekLogs,
  getSettings, getLogForDate, removeFoodEntry, PHASES,
  getStreak, getWaterToday, addWater, setWaterToday,
  copyDayEntries, addFoodEntry, getProfiles, getActiveProfileId,
} from '../db.js';
import { navigate, showToast, refresh } from '../app.js';

const RING_R    = 75;
const RING_CIRC = 2 * Math.PI * RING_R;

const MEALS = [
  { key: 'fruehstueck', label: 'Frühstück',  icon: '🌅', pct: 0.25 },
  { key: 'mittagessen', label: 'Mittagessen', icon: '☀️', pct: 0.35 },
  { key: 'abendessen',  label: 'Abendessen',  icon: '🌙', pct: 0.30 },
  { key: 'snack',       label: 'Snacks',      icon: '🍎', pct: 0.10 },
  { key: 'getraenke',   label: 'Getränke',    icon: '🥤', pct: 0     },
];

const DAYS_SHORT = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
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

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function weekBarsHtml(weekLogs, effectiveGoal) {
  const maxKcal = Math.max(...weekLogs.map(d => d.sum.kcal), effectiveGoal) || 1;
  const barH    = 36;
  return weekLogs.map((d, i) => {
    const isToday  = i === 6;
    const hasData  = d.sum.kcal > 50;
    const isOver   = hasData && d.sum.kcal > effectiveGoal;
    const pct      = hasData ? Math.min(d.sum.kcal / maxKcal, 1) : 0;
    const h        = Math.max(Math.round(pct * barH), 3);
    const dayDate  = new Date(d.date + 'T12:00:00');
    const dayLabel = DAYS_SHORT[dayDate.getDay()];
    let cls = '';
    if (isToday && hasData) cls = 'today';
    else if (isOver)        cls = 'over-day';
    else if (hasData)       cls = 'filled';

    return `
      <div class="week-bar-wrap" title="${d.date}: ${d.sum.kcal} kcal">
        <div class="week-bar ${cls}" style="height:${h}px"></div>
        <div class="week-bar-label ${isToday ? 'today' : ''}">${dayLabel}</div>
      </div>`;
  }).join('');
}

export async function renderDashboard(container) {
  const [log, settings, weekLogs, yesterdayLog, streak, waterMl, profiles] = await Promise.all([
    getTodayLog(), getSettings(), getWeekLogs(), getLogForDate(yesterday()),
    getStreak(), getWaterToday(), getProfiles(),
  ]);

  const pid            = getActiveProfileId();
  const profile        = profiles.find(p => p.id === pid) ?? { name: pid, emoji: '👤', color: '#6C63FF' };
  const phase          = PHASES.find(p => p.id === (settings.phase ?? 'ausgewogen')) ?? PHASES[0];
  const totals         = sumLog(log);
  const byMeal         = entriesByMeal(log);
  const mealKcal       = sumByMeal(log);
  const activeOffset   = settings.defizit != null ? settings.defizit : phase.offset;
  const effectiveGoal  = settings.dailyGoal + activeOffset;
  const totalBudget    = effectiveGoal + (settings.activityKcal ?? 0);
  const remaining      = totalBudget - totals.kcal;
  const isOverToday    = totals.kcal > totalBudget;
  const waterGoal      = settings.waterGoalMl ?? 2500;
  const waterPct       = Math.min(waterMl / waterGoal * 100, 100).toFixed(0);

  const proteinGoal = Math.round(totalBudget * phase.macros.protein / 100 / 4);
  const carbsGoal   = Math.round(totalBudget * phase.macros.carbs   / 100 / 4);
  const fatGoal     = Math.round(totalBudget * phase.macros.fat     / 100 / 9);

  const yesterdayTotals  = sumLog(yesterdayLog);
  const yesterdaySurplus = yesterdayTotals.kcal > 50
    ? Math.max(0, yesterdayTotals.kcal - effectiveGoal) : 0;
  const compensation = Math.min(Math.round(yesterdaySurplus / 2), 300);

  const hasRoutine     = (settings.routine ?? []).length > 0;
  const hasYesterday   = yesterdayTotals.kcal > 50;

  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const now    = new Date();
  const dateStr = `${now.getDate()}. ${months[now.getMonth()]}`;

  container.innerHTML = `
    <!-- Greeting Header -->
    <div class="greeting-header">
      <div>
        <div class="greeting-main">${greeting()}, ${profile.name}! ${profile.emoji}</div>
        <div class="greeting-sub">${dateStr} · Phase: <strong style="color:var(--accent)">${phase.label}</strong></div>
      </div>
    </div>

    <!-- Streak -->
    ${streak > 0 ? `
    <div style="padding:0 20px 8px">
      <span class="streak-badge">🔥 ${streak} Tag${streak !== 1 ? 'e' : ''} in Folge</span>
    </div>` : ''}

    <!-- Warnings -->
    ${yesterdaySurplus > 50 ? `
    <div class="section" style="padding-bottom:0">
      <div style="background:var(--orange-dim);border:1px solid var(--orange);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px">
        <span style="color:var(--orange);font-weight:700">⚖️ Gestern ${yesterdaySurplus} kcal zu viel</span>
        <span style="color:var(--text-2)"> — heute ${compensation} kcal weniger empfohlen (${totalBudget - compensation} kcal)</span>
      </div>
    </div>` : ''}

    ${isOverToday ? `
    <div class="section" style="padding-bottom:0">
      <div style="background:var(--red-dim);border:1px solid var(--red);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px">
        <span style="color:var(--red);font-weight:700">🔴 Tagesziel überschritten!</span>
        <span style="color:var(--text-2)"> ${Math.abs(Math.round(remaining))} kcal über Budget</span>
      </div>
    </div>` : ''}

    <!-- Kalorienring -->
    <div class="calorie-ring-wrap">
      <div class="ring-container">
        <svg class="calorie-ring" viewBox="0 0 170 170">
          <circle class="ring-bg"   cx="85" cy="85" r="${RING_R}"/>
          <circle class="ring-fill ${ringClass(totals.kcal, totalBudget)}" id="ring-fill-circle"
            cx="85" cy="85" r="${RING_R}"
            stroke-dasharray="${RING_CIRC.toFixed(1)}"
            stroke-dashoffset="${RING_CIRC.toFixed(1)}"/>
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

      <!-- Week bar chart -->
      <div class="week-bars" style="margin-top:12px;padding:0 24px">
        ${weekBarsHtml(weekLogs, effectiveGoal)}
      </div>
      <div style="font-size:11px;color:var(--text-3);text-align:center;margin-top:4px">
        P${phase.macros.protein}% K${phase.macros.carbs}% F${phase.macros.fat}%
      </div>
    </div>

    <!-- Routine + Copy Yesterday Quick Actions -->
    ${hasRoutine || hasYesterday ? `
    <div style="display:flex;gap:8px;padding:0 20px 12px">
      ${hasRoutine ? `
      <button class="btn btn-ghost btn-sm" id="btn-routine" style="flex:1;background:var(--accent-dim);color:var(--accent);border-color:var(--accent)">
        ⚡ Routine tracken
      </button>` : ''}
      ${hasYesterday ? `
      <button class="btn btn-ghost btn-sm" id="btn-copy-yesterday" style="flex:1">
        📋 Gestern kopieren
      </button>` : ''}
    </div>` : ''}

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

    <!-- Wasser Widget -->
    <div class="water-widget">
      <div class="water-header">
        <div class="water-title">💧 Wasser</div>
        <div class="water-value">${(waterMl / 1000).toFixed(2).replace('.', ',')}L / ${(waterGoal / 1000).toFixed(1).replace('.', ',')}L</div>
      </div>
      <div class="water-bar-track">
        <div class="water-bar-fill" style="width:${waterPct}%"></div>
      </div>
      <div class="water-btns">
        <button class="water-btn minus" id="btn-water-minus">−250ml</button>
        <button class="water-btn" id="btn-water-250">+250ml</button>
        <button class="water-btn" id="btn-water-500">+500ml</button>
        <button class="water-btn" id="btn-water-750">+750ml</button>
      </div>
    </div>

    <!-- Mahlzeiten-Übersicht -->
    <div class="section">
      <div class="section-label">Tagesübersicht</div>
      ${MEALS.map(m => {
        const target   = m.pct > 0 ? Math.round(totalBudget * m.pct) : null;
        const consumed = mealKcal[m.key] ?? 0;
        const entries  = byMeal[m.key] ?? [];
        const pct      = target ? Math.min(consumed / target * 100, 100) : 0;
        const over     = target && consumed > target;


        return `
        <div class="meal-section card" style="margin-bottom:10px">
          <div class="meal-header" data-meal="${m.key}" style="cursor:pointer">
            <div style="display:flex;align-items:center;gap:10px;padding:12px 14px">
              <span style="font-size:20px">${m.icon}</span>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:600">${m.label}</div>
                ${target ? `
                <div style="height:4px;background:var(--surface-3);border-radius:2px;margin-top:5px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${over ? 'var(--red)' : 'var(--accent)'};border-radius:2px;transition:width 0.5s ease"></div>
                </div>` : ''}
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:15px;font-weight:700;color:${over ? 'var(--red)' : 'var(--accent)'}">
                  ${consumed}${target ? ` <span style="font-size:11px;font-weight:400;color:var(--text-3)">/ ${target}</span>` : ''}
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
              ${activeOffset !== 0 ? ` ${activeOffset > 0 ? '+' : ''}${activeOffset} ${settings.defizit != null ? 'Defizit' : phase.label}` : ''}
              ${settings.activityKcal ? ` + ${settings.activityKcal} Aktivität` : ''}
              ${compensation > 0 ? ` · −${compensation} Ausgleich empfohlen` : ''}
            </div>
          </div>
          <div class="card-right">
            <div class="card-kcal" style="color:${isOverToday ? 'var(--red)' : 'inherit'}">${Math.round(totals.kcal / totalBudget * 100)}%</div>
            <div class="card-kcal-label">erreicht</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Animate ring after render
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ring = container.querySelector('#ring-fill-circle');
      if (ring) ring.style.strokeDashoffset = ringOffset(totals.kcal, totalBudget).toFixed(1);
    });
  });

  // Meal header toggle
  container.querySelectorAll('.meal-header').forEach(h => {
    h.addEventListener('click', () => {
      const list = container.querySelector(`#entries-${h.dataset.meal}`);
      if (list) list.style.display = list.style.display === 'none' ? '' : 'none';
    });
  });

  // Add meal button
  container.querySelectorAll('[data-add-meal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window._preselectedMeal = btn.dataset.addMeal;
      navigate('log');
    });
  });

  // Delete entry
  container.querySelectorAll('.entry-del').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await removeFoodEntry(Number(btn.dataset.id));
      showToast('Eintrag gelöscht');
      refresh();
    });
  });

  // Water buttons
  const updateWaterWidget = async (newMl) => {
    const goal = settings.waterGoalMl ?? 2500;
    const pct  = Math.min(newMl / goal * 100, 100).toFixed(0);
    container.querySelector('.water-bar-fill').style.width = `${pct}%`;
    container.querySelector('.water-value').textContent =
      `${(newMl / 1000).toFixed(2).replace('.', ',')}L / ${(goal / 1000).toFixed(1).replace('.', ',')}L`;
  };

  container.querySelector('#btn-water-minus')?.addEventListener('click', async () => {
    const v = await addWater(-250);
    await updateWaterWidget(v);
  });
  container.querySelector('#btn-water-250')?.addEventListener('click', async () => {
    const v = await addWater(250);
    await updateWaterWidget(v);
    showToast('💧 +250ml');
  });
  container.querySelector('#btn-water-500')?.addEventListener('click', async () => {
    const v = await addWater(500);
    await updateWaterWidget(v);
    showToast('💧 +500ml');
  });
  container.querySelector('#btn-water-750')?.addEventListener('click', async () => {
    const v = await addWater(750);
    await updateWaterWidget(v);
    showToast('💧 +750ml');
  });

  // Routine tracken
  container.querySelector('#btn-routine')?.addEventListener('click', async () => {
    const s       = await getSettings();
    const routine = s.routine ?? [];
    if (!routine.length) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = await (await import('../db.js')).getTodayLog();
    let added = 0;
    for (const item of routine) {
      const { id: _id, ...entry } = item;
      await addFoodEntry({ ...entry });
      added++;
    }
    showToast(`✅ ${added} Routine-Einträge getrackt`);
    refresh();
  });

  // Gestern kopieren
  container.querySelector('#btn-copy-yesterday')?.addEventListener('click', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const result   = await copyDayEntries(yesterday(), todayStr);
    if (result) {
      showToast(`📋 ${result.entries.length} Einträge von gestern kopiert`);
      refresh();
    } else {
      showToast('Gestern keine Einträge');
    }
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

import {
  getSettings, getWeekPlan, saveWeekPlan,
  getDislikedIngredients, saveDislikedIngredients,
  addShoppingItems, PHASES,
} from '../db.js';
import { generateWeeklyMeals } from '../api.js';
import { showToast } from '../app.js';

const DAYS_SHORT = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const DAYS_FULL  = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const MONTHS     = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

let currentWeekStart = getWeekStart();
let peopleCount      = 1;

export async function renderWeekplan(container) {
  await paint(container);
}

async function paint(container) {
  const [settings, disliked, weekPlan] = await Promise.all([
    getSettings(), getDislikedIngredients(), getWeekPlan(currentWeekStart),
  ]);

  const phase     = PHASES.find(p => p.id === (settings.phase ?? 'ausgewogen')) ?? PHASES[0];
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const kw        = getWeekNumber(new Date(currentWeekStart + 'T12:00:00'));
  const todayStr  = new Date().toISOString().split('T')[0];
  const hasKey    = !!settings.apiKey;

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Wochenplan</h1>
        <div class="subtitle">Mahlzeiten planen &amp; Einkauf</div>
      </div>
    </header>

    <div style="display:flex;align-items:center;justify-content:space-between;padding:0 20px 12px">
      <button class="btn btn-ghost btn-sm" id="btn-prev-week" style="font-size:18px;width:36px;height:36px;padding:0">‹</button>
      <div style="text-align:center">
        <div style="font-size:14px;font-weight:700">KW ${kw}</div>
        <div style="font-size:12px;color:var(--text-3)">${fmtShort(currentWeekStart)} – ${fmtShort(addDays(currentWeekStart, 6))}</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-next-week" style="font-size:18px;width:36px;height:36px;padding:0">›</button>
    </div>

    <!-- Personen-Auswahl -->
    <div style="padding:0 20px 14px">
      <div style="font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">
        Portionen für
      </div>
      <div class="pill-tabs" style="gap:6px">
        ${[1,2,3,4,5,6].map(n => `
          <button class="pill ${n === peopleCount ? 'active' : ''}" data-people="${n}" style="min-width:40px">
            ${n}${n === 1 ? ' Person' : ' Pers.'}
          </button>`).join('')}
      </div>
    </div>

    <div style="padding:0 20px 16px;display:flex;gap:10px">
      <button class="btn btn-primary" id="btn-generate" style="flex:1"
        ${!hasKey ? 'disabled title="API-Key in Einstellungen eintragen"' : ''}>
        ${!hasKey ? '⚠ API-Key fehlt' : weekPlan ? '🔄 Woche neu generieren' : '✨ Woche generieren'}
      </button>
      ${weekPlan ? `<button class="btn btn-ghost" id="btn-shopping" style="flex-shrink:0">🛒 Einkaufsliste</button>` : ''}
    </div>

    ${!hasKey ? `
    <div style="margin:0 20px 16px;padding:12px;background:var(--orange-dim);border-radius:var(--radius-sm);font-size:13px;color:var(--orange)">
      API-Key in <strong>Einstellungen</strong> eintragen um Rezepte zu generieren.
    </div>` : ''}

    ${weekPlan?.people && weekPlan.people > 1 ? `
    <div style="margin:0 20px 16px;padding:10px 14px;background:var(--accent-dim);border-radius:var(--radius-sm);font-size:13px;color:var(--accent)">
      👨‍👩‍👧‍👦 Plan für ${weekPlan.people} Personen · Zutatenmengen entsprechend skaliert
    </div>` : ''}

    <div style="padding:0 20px">
      ${weekDates.map((date, i) => {
        const recipe  = weekPlan?.days?.[i]?.recipe ?? null;
        const isToday = date === todayStr;
        return dayCard(date, DAYS_SHORT[i], DAYS_FULL[i], recipe, isToday, weekPlan?.people ?? 1, settings.routine ?? []);
      }).join('')}
    </div>

    <div class="section">
      <div class="section-label">Mag ich nicht</div>
      <div class="card" style="padding:14px">
        ${disliked.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px" id="dislike-tags">
          ${disliked.map((item, idx) => `
            <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--red-dim);color:var(--red);border-radius:99px;font-size:13px;font-weight:500">
              ${escHtml(item)}
              <button class="dislike-remove" data-idx="${idx}"
                style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;padding:0;line-height:1">×</button>
            </span>`).join('')}
        </div>` : `
        <div style="font-size:13px;color:var(--text-3);margin-bottom:12px">
          Noch keine Einträge — tippe auf "Mag ich nicht" bei einer Zutat
        </div>`}
        <div style="display:flex;gap:8px">
          <input id="dislike-input" class="input" type="text" placeholder="Zutat die du nicht magst…" style="flex:1">
          <button class="btn btn-ghost" id="btn-add-dislike" style="flex-shrink:0;white-space:nowrap">+ Hinzufügen</button>
        </div>
      </div>
    </div>
  `;

  // People selector
  container.querySelectorAll('[data-people]').forEach(pill => {
    pill.addEventListener('click', () => {
      peopleCount = parseInt(pill.dataset.people);
      container.querySelectorAll('[data-people]').forEach(p =>
        p.classList.toggle('active', parseInt(p.dataset.people) === peopleCount));
    });
  });

  // Week navigation
  container.querySelector('#btn-prev-week').addEventListener('click', async () => {
    currentWeekStart = addDays(currentWeekStart, -7);
    await paint(container);
  });
  container.querySelector('#btn-next-week').addEventListener('click', async () => {
    currentWeekStart = addDays(currentWeekStart, 7);
    await paint(container);
  });

  // Generate week
  container.querySelector('#btn-generate')?.addEventListener('click', async () => {
    if (!settings.apiKey) return;
    const btn = container.querySelector('#btn-generate');
    btn.disabled    = true;
    btn.textContent = `⏳ Generiere 7 Rezepte${peopleCount > 1 ? ` für ${peopleCount} Personen` : ''}…`;
    try {
      const [freshDisliked, freshSettings] = await Promise.all([
        getDislikedIngredients(), getSettings(),
      ]);
      const freshPhase = PHASES.find(p => p.id === (freshSettings.phase ?? 'ausgewogen')) ?? PHASES[0];
      const recipes    = await generateWeeklyMeals(freshSettings.apiKey, {
        phase:      freshPhase,
        disliked:   freshDisliked,
        dinnerKcal: 1100,
        people:     peopleCount,
      });
      const plan = {
        weekStart:   currentWeekStart,
        generatedAt: new Date().toISOString(),
        people:      peopleCount,
        days:        weekDates.map((date, i) => ({
          date,
          dayName: DAYS_FULL[i],
          recipe:  recipes[i] ?? null,
        })),
      };
      await saveWeekPlan(currentWeekStart, plan);
      showToast('Wochenplan generiert ✓');
      await paint(container);
    } catch (e) {
      showToast('Fehler: ' + e.message);
      btn.disabled    = false;
      btn.textContent = weekPlan ? '🔄 Woche neu generieren' : '✨ Woche generieren';
    }
  });

  // Shopping list from week plan
  container.querySelector('#btn-shopping')?.addEventListener('click', async () => {
    const plan = await getWeekPlan(currentWeekStart);
    if (!plan) return;
    const seen  = new Set();
    const items = [];
    for (const day of plan.days) {
      for (const z of day.recipe?.zutaten ?? []) {
        const key = z.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ name: z.name, amount: `${z.menge} ${z.einheit}`.trim() });
        }
      }
    }
    await addShoppingItems(items);
    showToast(`${items.length} Zutaten zur Einkaufsliste hinzugefügt ✓`);
  });

  // Recipe expand/collapse
  container.querySelectorAll('.recipe-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const card    = btn.closest('.day-card');
      const details = card.querySelector('.recipe-details');
      const open    = details.style.display !== 'none';
      details.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '▸' : '▾';
    });
  });

  // Mark ingredient as disliked
  container.querySelectorAll('.dislike-ingredient').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ingredient = btn.dataset.ingredient;
      const current    = await getDislikedIngredients();
      if (!current.includes(ingredient)) {
        await saveDislikedIngredients([...current, ingredient]);
        btn.textContent = '✓ Gemerkt';
        btn.style.color = 'var(--green)';
        btn.disabled    = true;
        showToast(`"${ingredient}" gemerkt — gilt ab nächster Generierung`);
      }
    });
  });

  // Remove from dislike list
  container.querySelectorAll('.dislike-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx     = parseInt(btn.dataset.idx);
      const current = await getDislikedIngredients();
      current.splice(idx, 1);
      await saveDislikedIngredients([...current]);
      await paint(container);
    });
  });

  const dislikeInput = container.querySelector('#dislike-input');
  const addDislike   = async () => {
    const val = dislikeInput.value.trim();
    if (!val) return;
    const current = await getDislikedIngredients();
    if (current.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
      showToast('Bereits in der Liste');
      return;
    }
    await saveDislikedIngredients([...current, val]);
    await paint(container);
  };
  container.querySelector('#btn-add-dislike')?.addEventListener('click', addDislike);
  dislikeInput?.addEventListener('keydown', e => { if (e.key === 'Enter') addDislike(); });
}

// ── Day Card ──────────────────────────────────────────────
function dayCard(date, dayShort, dayFull, recipe, isToday, people, routine) {
  const d          = new Date(date + 'T12:00:00');
  const dateStr    = `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const pLabel     = people > 1 ? ` (${people}×)` : '';

  const routineKcal = routine.reduce((sum, r) =>
    sum + Math.round((r.kcal_100g ?? 0) * r.amount / 100), 0);
  const total = routineKcal + (recipe?.kcal ?? 0);

  const MEAL_ICONS = {
    fruehstueck: '🌅', mittagessen: '☀️', abendessen: '🌙',
    snack: '🍎', getraenke: '🥤',
  };
  const MEAL_LABELS = {
    fruehstueck: 'Frühstück', mittagessen: 'Mittagessen', abendessen: 'Abendessen',
    snack: 'Snack', getraenke: 'Getränk',
  };

  const routineRows = routine.length === 0
    ? `<div style="padding:8px 14px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-3)">
        Keine Routine — in Einstellungen hinzufügen
       </div>`
    : routine.map(r => {
        const kcal    = Math.round((r.kcal_100g    ?? 0) * r.amount / 100);
        const protein = Math.round((r.protein_100g ?? 0) * r.amount / 100 * 10) / 10;
        const fat     = Math.round((r.fat_100g     ?? 0) * r.amount / 100 * 10) / 10;
        const carbs   = Math.round((r.carbs_100g   ?? 0) * r.amount / 100 * 10) / 10;
        const icon    = MEAL_ICONS[r.meal_type]  ?? '🍽';
        const label   = MEAL_LABELS[r.meal_type] ?? r.meal_type;
        return `
        <div style="padding:8px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${escHtml(r.name)}</div>
            <div style="font-size:11px;color:var(--text-3)">
              ${r.amount}g · ${label} · P: ${protein}g · F: ${fat}g · KH: ${carbs}g
            </div>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--accent);flex-shrink:0">${kcal} kcal</div>
        </div>`;
      }).join('');

  return `
    <div class="day-card card" style="margin-bottom:10px${isToday ? ';border-color:var(--accent);border-width:2px' : ''}">

      <div style="padding:9px 14px;background:${isToday ? 'var(--accent-dim)' : 'var(--surface-2)'};border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:14px;font-weight:700;color:${isToday ? 'var(--accent)' : 'var(--text)'}">
          ${dayFull}${isToday ? ' <span style="font-size:10px;font-weight:500;margin-left:4px">Heute</span>' : ''}
        </div>
        <div style="font-size:12px;color:var(--text-3)">${dateStr}</div>
      </div>

      ${routineRows}

      ${recipe ? `
      <div>
        <div style="padding:8px 14px;display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">🍽</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escHtml(recipe.name)}${pLabel}
            </div>
            <div style="font-size:11px;color:var(--text-3)">Abendessen · ${recipe.protein ?? '?'}g Protein</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <div style="font-size:13px;font-weight:700;color:var(--accent)">${recipe.kcal} kcal</div>
            <button class="recipe-toggle" style="background:var(--surface-3);border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:12px;color:var(--text-2)">▸</button>
          </div>
        </div>

        <div class="recipe-details" style="display:none;border-top:1px solid var(--border);padding:12px 14px">
          <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px">
            Zutaten${people > 1 ? ` (für ${people} Personen)` : ''}:
          </div>
          ${(recipe.zutaten ?? []).map(z => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);gap:8px">
              <span style="font-size:12px;flex:1">
                ${escHtml(z.name)} <span style="color:var(--text-3)">${z.menge} ${z.einheit}</span>
              </span>
              <button class="dislike-ingredient" data-ingredient="${escAttr(z.name)}"
                style="background:var(--surface-3);border:none;border-radius:99px;padding:2px 8px;font-size:10px;color:var(--text-3);cursor:pointer;white-space:nowrap">
                Mag ich nicht
              </button>
            </div>`).join('')}

          <div style="font-size:12px;font-weight:600;color:var(--text-2);margin:10px 0 6px">Zubereitung:</div>
          <div style="font-size:12px;color:var(--text-2);line-height:1.7">${escHtml(recipe.anleitung ?? '')}</div>

          <div style="display:flex;gap:6px;margin-top:10px">
            <span style="padding:3px 10px;background:var(--accent-dim);color:var(--accent);border-radius:99px;font-size:11px;font-weight:600">${recipe.protein ?? '?'}g P</span>
            <span style="padding:3px 10px;background:var(--surface-3);color:var(--text-2);border-radius:99px;font-size:11px">${recipe.carbs ?? '?'}g K</span>
            <span style="padding:3px 10px;background:var(--surface-3);color:var(--text-2);border-radius:99px;font-size:11px">${recipe.fat ?? '?'}g F</span>
          </div>
        </div>
      </div>` : `
      <div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px;opacity:0.3">🍽</span>
        <div style="font-size:13px;color:var(--text-3)">Kein Rezept geplant</div>
      </div>`}

      <div style="padding:5px 14px;background:var(--surface-2);border-top:1px solid var(--border);text-align:right">
        <span style="font-size:11px;color:var(--text-3)">Tagessumme: </span>
        <span style="font-size:12px;font-weight:700;color:${recipe ? 'var(--text)' : 'var(--text-3)'}">${total} kcal</span>
      </div>

    </div>`;
}

// ── Helpers ───────────────────────────────────────────────
function getWeekStart(date = new Date()) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - y) / 86400000 + 1) / 7);
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

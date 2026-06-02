import { generateRecipe, askNutritionQuestion } from '../api.js';
import {
  getSettings, saveMeal, getSavedMeals, deleteMeal, updateMeal,
  toggleFavorite, addShoppingItems, getLogForDate, sumLog, PHASES,
  getActiveProfileId, getProfiles, getWeekPlan, saveWeekPlan,
} from '../db.js';
import { showToast, navigate, openModal, closeModal } from '../app.js';

const PREFERENCES = [
  { id: 'ausgewogen',   label: 'Ausgewogen'  },
  { id: 'low-carb',     label: 'Low-Carb'    },
  { id: 'vegetarisch',  label: 'Vegetarisch' },
  { id: 'vegan',        label: 'Vegan'       },
  { id: 'high-protein', label: 'High-Protein'},
  { id: 'schnell',      label: '< 30 Min'   },
];

let selectedPref     = 'ausgewogen';
let generatedRecipes = [];
let chatHistory      = [];

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export async function renderRecipes(container) {
  const [settings, saved, yesterdayLog, profiles] = await Promise.all([
    getSettings(), getSavedMeals(), getLogForDate(yesterday()), getProfiles(),
  ]);

  const pid       = getActiveProfileId();
  const profile   = profiles.find(p => p.id === pid) ?? { name: pid };
  const hasKey    = !!settings.apiKey;
  const favorites = saved.filter(m => m.favorite);
  const others    = saved.filter(m => !m.favorite);

  const phase           = PHASES.find(p => p.id === (settings.phase ?? 'ausgewogen')) ?? PHASES[0];
  const activeOffset    = settings.defizit != null ? settings.defizit : phase.offset;
  const routineKcal     = (settings.routine ?? []).reduce((s, r) => s + Math.round((r.kcal_100g ?? 0) * r.amount / 100), 0);
  const totalBudget     = settings.dailyGoal + (settings.activityKcal ?? 0) + activeOffset;
  const effectiveGoal   = totalBudget;
  const availableKcal   = Math.max(400, totalBudget - routineKcal);
  const yesterdayKcal   = sumLog(yesterdayLog).kcal;
  const yesterdaySurplus = yesterdayKcal > 50
    ? Math.max(0, yesterdayKcal - effectiveGoal) : 0;
  const recommendedKcal = yesterdaySurplus > 50
    ? Math.max(400, availableKcal - Math.min(Math.round(yesterdaySurplus / 2), 300))
    : availableKcal;

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Rezepte</h1>
        <div class="subtitle">KI-generierte Mahlzeiten</div>
      </div>
    </header>

    ${!hasKey ? `
    <div class="section">
      <div class="card" style="padding:16px;background:var(--orange-dim);border-color:var(--orange)">
        <div style="font-size:14px;color:var(--orange);font-weight:600;margin-bottom:6px">⚠️ API-Key fehlt</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          Für KI-Rezepte und Ernährungsberatung benötigst du einen Anthropic API-Key.
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-goto-settings">Zu den Einstellungen</button>
      </div>
    </div>` : ''}

    ${yesterdaySurplus > 50 ? `
    <div class="section" style="padding-bottom:0">
      <div style="background:var(--orange-dim);border:1px solid var(--orange);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px">
        <span style="color:var(--orange);font-weight:700">⚖️ Gestern ${yesterdaySurplus} kcal zu viel</span>
        <span style="color:var(--text-2)"> — Rezept auf <strong>${recommendedKcal} kcal</strong> voreingestellt</span>
      </div>
    </div>` : ''}

    <!-- Generator -->
    <div class="section">
      <div class="section-label">Rezept generieren</div>
      <div class="gen-form">
        <div style="margin-bottom:8px;padding:8px 12px;background:var(--accent-dim);border-radius:var(--radius-sm);font-size:12px;color:var(--text-2)">
          Phase: <strong style="color:var(--accent)">${phase.label}</strong> — ${phase.desc}
        </div>
        <div style="margin-bottom:10px;padding:8px 12px;background:var(--surface-3);border-radius:var(--radius-sm);font-size:12px;color:var(--text-2);display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px">
          <span>Budget: <strong>${totalBudget}</strong> kcal</span>
          ${routineKcal > 0 ? `<span>Routine: <strong>−${routineKcal}</strong> kcal</span>` : ''}
          <span style="color:var(--accent);font-weight:700">Verfügbar: ${availableKcal} kcal</span>
        </div>
        <div class="gen-row">
          <div class="input-group">
            <label class="input-label">Kalorien</label>
            <input id="kcal-input" class="input" type="number" min="100" max="3000"
              value="${recommendedKcal}" inputmode="numeric">
          </div>
          <div class="input-group">
            <label class="input-label">Anzahl</label>
            <select id="meals-input" class="input">
              <option value="1">1 Rezept</option>
              <option value="2">2 Rezepte</option>
              <option value="3">3 Rezepte</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:16px">
          <div class="input-label">Ernährungsstil</div>
          <div class="pill-tabs" style="padding:6px 0 0">
            ${PREFERENCES.map(p => `
              <button class="pill ${p.id === selectedPref ? 'active' : ''}" data-pref="${p.id}">
                ${p.label}
              </button>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary" id="btn-generate" ${!hasKey ? 'disabled' : ''}>
          ✨ Rezept von KI generieren
        </button>
      </div>
    </div>

    <div id="recipe-result"></div>

    <!-- Lieblingsrezepte -->
    ${favorites.length > 0 ? `
    <div class="section">
      <div class="section-label">⭐ Lieblingsrezepte (${favorites.length})</div>
      <div id="favorites-list">
        ${favorites.map(m => savedMealCard(m)).join('')}
      </div>
    </div>` : ''}

    <!-- Alle gespeicherten -->
    ${others.length > 0 ? `
    <div class="section">
      <div class="section-label">Gespeicherte Rezepte (${others.length})</div>
      <div id="saved-list">
        ${others.map(m => savedMealCard(m)).join('')}
      </div>
    </div>` : ''}

    <!-- Claude Chat Widget -->
    <div class="section">
      <div class="section-label">🤖 Ernährungsberater</div>
      <div class="chat-widget">
        <div class="chat-history" id="chat-history">
          ${chatHistory.length === 0
            ? `<div class="chat-empty-hint">🤖 Stell mir eine Frage zu Ernährung,<br>Kalorien oder Rezepten!</div>`
            : chatHistory.map(m => `
                <div class="chat-msg ${m.role}">${escHtml(m.text)}</div>`).join('')}
        </div>
        <div class="chat-input-row">
          <input id="chat-input" class="input" type="text"
            placeholder="${hasKey ? 'Frage stellen…' : 'API-Key benötigt'}"
            ${!hasKey ? 'disabled' : ''}>
          <button class="btn btn-primary" id="btn-chat-send" ${!hasKey ? 'disabled' : ''}
            style="white-space:nowrap;flex-shrink:0;width:auto;min-width:80px">Senden</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-goto-settings')?.addEventListener('click', () => navigate('settings'));

  container.querySelectorAll('.pill[data-pref]').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedPref = pill.dataset.pref;
      container.querySelectorAll('.pill[data-pref]').forEach(p =>
        p.classList.toggle('active', p.dataset.pref === selectedPref));
    });
  });

  container.querySelector('#btn-generate')?.addEventListener('click', async () => {
    const kcal  = parseInt(container.querySelector('#kcal-input').value) || recommendedKcal;
    const meals = parseInt(container.querySelector('#meals-input').value) || 1;
    await runGenerate(container, settings.apiKey, kcal, selectedPref, meals, phase);
  });

  // Delegated events for saved recipes
  const handleSavedActions = async (e) => {
    const favBtn  = e.target.closest('[data-fav]');
    const editBtn = e.target.closest('[data-edit]');
    const delBtn  = e.target.closest('[data-del-meal]');
    const shopBtn = e.target.closest('[data-shop-meal]');

    if (favBtn) {
      await toggleFavorite(Number(favBtn.dataset.fav));
      renderRecipes(container);
    }
    if (editBtn) {
      const meal = (await getSavedMeals()).find(m => m.id === Number(editBtn.dataset.edit));
      if (meal) openEditModal(meal, () => renderRecipes(container));
    }
    if (delBtn) {
      if (!confirm('Rezept löschen?')) return;
      await deleteMeal(Number(delBtn.dataset.delMeal));
      showToast('Rezept gelöscht');
      renderRecipes(container);
    }
    if (shopBtn) {
      const meal = (await getSavedMeals()).find(m => m.id === Number(shopBtn.dataset.shopMeal));
      if (meal?.zutaten) {
        await addShoppingItems(meal.zutaten.map(z => ({ name: z.name, amount: `${z.menge} ${z.einheit}` })));
        showToast('Zutaten zur Einkaufsliste hinzugefügt');
        navigate('shopping');
      }
    }
  };

  container.querySelector('#favorites-list')?.addEventListener('click', handleSavedActions);
  container.querySelector('#saved-list')?.addEventListener('click', handleSavedActions);

  // Chat widget
  const chatInput  = container.querySelector('#chat-input');
  const chatSend   = container.querySelector('#btn-chat-send');
  const chatHistEl = container.querySelector('#chat-history');

  const sendChat = async () => {
    const q = chatInput.value.trim();
    if (!q || !settings.apiKey) return;

    chatInput.value   = '';
    chatInput.disabled = true;
    chatSend.disabled  = true;
    chatSend.textContent = '…';

    chatHistory.push({ role: 'user', text: q });
    appendChatMsg(chatHistEl, 'user', q);
    chatHistEl.scrollTop = chatHistEl.scrollHeight;

    try {
      const todayLog  = await (await import('../db.js')).getTodayLog();
      const todayTots = sumLog(todayLog);
      const answer    = await askNutritionQuestion(settings.apiKey, q, {
        kcal:        totalsForChat(todayTots),
        goal:        effectiveGoal,
        protein:     todayTots.protein,
        profileName: profile.name,
      });
      chatHistory.push({ role: 'claude', text: answer });
      appendChatMsg(chatHistEl, 'claude', answer);
    } catch (err) {
      chatHistory.push({ role: 'claude', text: 'Fehler: ' + err.message });
      appendChatMsg(chatHistEl, 'claude', 'Fehler: ' + err.message);
    } finally {
      chatInput.disabled   = false;
      chatSend.disabled    = false;
      chatSend.textContent = 'Senden';
      chatHistEl.scrollTop = chatHistEl.scrollHeight;
      chatInput.focus();
    }
  };

  chatSend?.addEventListener('click', sendChat);
  chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

function totalsForChat(t) {
  return t.kcal;
}

function appendChatMsg(el, role, text) {
  const hint = el.querySelector('.chat-empty-hint');
  if (hint) hint.remove();
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.textContent = text;
  el.appendChild(div);
}

// ── Generate ──────────────────────────────────────────────
async function runGenerate(container, apiKey, kcal, preference, meals, phase) {
  const resultEl    = container.querySelector('#recipe-result');
  resultEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>KI generiert Rezept…</span></div>`;

  try {
    const recipes = await generateRecipe(apiKey, { kcal, preference, meals, phase });
    generatedRecipes = recipes;

    resultEl.innerHTML = `
      <div class="section" style="padding-top:0">
        <div class="section-label">Generiertes Rezept</div>
        ${recipes.map((r, i) => recipeCard(r, i)).join('')}
      </div>`;

    resultEl.querySelectorAll('[data-save-recipe]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await saveMeal(generatedRecipes[Number(btn.dataset.saveRecipe)]);
        showToast('Rezept gespeichert');
        renderRecipes(container);
      });
    });

    resultEl.querySelectorAll('[data-assign-recipe]').forEach(btn => {
      btn.addEventListener('click', () => {
        const recipe = generatedRecipes[Number(btn.dataset.assignRecipe)];
        openDatePickerModal(recipe, async (dateStr) => {
          await assignRecipeToWeekplan(recipe, dateStr);
          const d    = new Date(dateStr + 'T12:00:00');
          const days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
          showToast(`📅 ${days[d.getDay()]}, ${d.getDate()}.${d.getMonth()+1}. im Wochenplan`);
        });
      });
    });

    resultEl.querySelectorAll('[data-shop-recipe]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = generatedRecipes[Number(btn.dataset.shopRecipe)];
        await addShoppingItems(r.zutaten.map(z => ({ name: z.name, amount: `${z.menge} ${z.einheit}` })));
        showToast('Zutaten zur Einkaufsliste hinzugefügt');
        navigate('shopping');
      });
    });

  } catch (err) {
    resultEl.innerHTML = `
      <div class="section" style="padding-top:0">
        <div class="card" style="padding:16px;background:var(--red-dim);border-color:var(--red)">
          <div style="font-size:14px;color:var(--red);font-weight:600;margin-bottom:4px">Fehler</div>
          <div style="font-size:13px;color:var(--text-2)">${escHtml(err.message)}</div>
        </div>
      </div>`;
  }
}

// ── Edit Modal ────────────────────────────────────────────
function openEditModal(meal, onSave) {
  openModal(box => {
    box.innerHTML += `
      <div class="modal-title">Rezept bearbeiten</div>
      <div style="padding:0 20px 16px">
        <div class="input-group">
          <label class="input-label">Name</label>
          <input id="edit-name" class="input" type="text" value="${escHtml(meal.name)}">
        </div>
        <div class="input-group">
          <label class="input-label">Kalorien gesamt</label>
          <input id="edit-kcal" class="input" type="number" value="${meal.gesamt_kcal ?? ''}" inputmode="numeric">
        </div>
        <div class="input-group">
          <label class="input-label">Zutaten</label>
          <div id="edit-ingredients">
            ${(meal.zutaten ?? []).map((z, i) => ingredientRow(z, i)).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-add-ingredient" style="width:100%;margin-top:6px">
            + Zutat hinzufügen
          </button>
        </div>
        <div class="input-group">
          <label class="input-label">Zubereitung</label>
          <textarea id="edit-instructions" class="input" rows="4"
            style="resize:vertical;font-family:inherit">${escHtml(meal.anleitung ?? '')}</textarea>
        </div>
        <button class="btn btn-primary" id="btn-save-edit">Speichern</button>
      </div>`;

    box.querySelector('#btn-add-ingredient').addEventListener('click', () => {
      const list = box.querySelector('#edit-ingredients');
      const idx  = list.children.length;
      const div  = document.createElement('div');
      div.innerHTML = ingredientRow({ name: '', menge: '', einheit: 'g', kcal: 0 }, idx);
      list.appendChild(div.firstElementChild);
    });

    box.querySelector('#edit-ingredients').addEventListener('click', e => {
      const del = e.target.closest('[data-del-ing]');
      if (del) del.closest('.ing-row')?.remove();
    });

    box.querySelector('#btn-save-edit').addEventListener('click', async () => {
      const zutaten = [...box.querySelectorAll('.ing-row')].map(row => ({
        name:    row.querySelector('.ing-name').value.trim(),
        menge:   parseFloat(row.querySelector('.ing-menge').value) || 0,
        einheit: row.querySelector('.ing-einheit').value.trim() || 'g',
        kcal:    parseInt(row.querySelector('.ing-kcal').value) || 0,
      })).filter(z => z.name);

      await updateMeal(meal.id, {
        name:        box.querySelector('#edit-name').value.trim() || meal.name,
        gesamt_kcal: parseInt(box.querySelector('#edit-kcal').value) || meal.gesamt_kcal,
        anleitung:   box.querySelector('#edit-instructions').value.trim(),
        zutaten,
      });
      closeModal();
      showToast('Rezept gespeichert');
      onSave();
    });
  });
}

function ingredientRow(z, i) {
  return `
    <div class="ing-row" style="display:grid;grid-template-columns:1fr 60px 50px 55px 28px;gap:4px;margin-bottom:6px;align-items:center">
      <input class="input ing-name"    style="font-size:13px;padding:8px 10px" type="text"   value="${escHtml(z.name)}"           placeholder="Zutat">
      <input class="input ing-menge"   style="font-size:13px;padding:8px 6px"  type="number" value="${z.menge}"                   placeholder="100">
      <input class="input ing-einheit" style="font-size:13px;padding:8px 6px"  type="text"   value="${escHtml(z.einheit ?? 'g')}" placeholder="g">
      <input class="input ing-kcal"    style="font-size:13px;padding:8px 6px"  type="number" value="${z.kcal}"                    placeholder="kcal">
      <button data-del-ing style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;padding:0">✕</button>
    </div>`;
}

// ── Recipe Cards ──────────────────────────────────────────
function recipeCard(recipe, idx) {
  const { name, zutaten = [], anleitung = '', gesamt_kcal } = recipe;
  return `
    <div class="recipe-card">
      <div class="recipe-header">
        <div class="recipe-title">${escHtml(name)}</div>
        <div class="recipe-kcal-badge">${gesamt_kcal} kcal</div>
      </div>
      <div class="recipe-ingredients">
        <div class="section-label" style="margin-bottom:8px">Zutaten</div>
        ${zutaten.map(z => `
          <div class="ingredient-row">
            <span class="ingredient-name">${escHtml(z.name)}</span>
            <span class="ingredient-amount">${z.menge} ${z.einheit}</span>
            <span class="ingredient-kcal">${z.kcal} kcal</span>
          </div>`).join('')}
      </div>
      <div class="recipe-instructions">
        <div class="section-label" style="margin-bottom:8px">Zubereitung</div>
        ${escHtml(anleitung).replace(/\n/g,'<br>')}
      </div>
      <div class="recipe-actions">
        <button class="btn btn-success btn-sm" style="flex:1" data-shop-recipe="${idx}">🛒 Einkauf</button>
        <button class="btn btn-primary btn-sm" style="flex:1" data-assign-recipe="${idx}">📅 Wochenplan</button>
        <button class="btn btn-ghost btn-sm"   style="flex:1" data-save-recipe="${idx}">💾 Speichern</button>
      </div>
    </div>`;
}

function savedMealCard(meal) {
  return `
    <div class="recipe-card">
      <div class="recipe-header">
        <div class="recipe-title">${escHtml(meal.name)}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          <button data-fav="${meal.id}" style="background:none;border:none;cursor:pointer;font-size:20px;padding:0;line-height:1"
            title="${meal.favorite ? 'Aus Favoriten entfernen' : 'Als Favorit markieren'}">
            ${meal.favorite ? '⭐' : '☆'}
          </button>
          <div class="recipe-kcal-badge">${meal.gesamt_kcal} kcal</div>
        </div>
      </div>
      ${(meal.zutaten?.length ?? 0) > 0 ? `
      <div class="recipe-ingredients" style="max-height:120px;overflow:hidden">
        ${meal.zutaten.slice(0, 4).map(z => `
          <div class="ingredient-row">
            <span class="ingredient-name">${escHtml(z.name)}</span>
            <span class="ingredient-amount">${z.menge} ${z.einheit}</span>
          </div>`).join('')}
        ${meal.zutaten.length > 4 ? `<div style="font-size:12px;color:var(--text-3);padding:4px 0">+ ${meal.zutaten.length - 4} weitere</div>` : ''}
      </div>` : ''}
      <div class="recipe-actions">
        <button class="btn btn-success btn-sm" style="flex:1" data-shop-meal="${meal.id}">🛒 Einkauf</button>
        <button class="btn btn-ghost btn-sm"   style="flex:1" data-edit="${meal.id}">✏️ Bearbeiten</button>
        <button class="btn btn-danger btn-sm"  style="flex:1" data-del-meal="${meal.id}">🗑️</button>
      </div>
    </div>`;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Wochenplan-Zuordnung ──────────────────────────────────
function getMondayStr(dateStr) {
  const d   = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

async function assignRecipeToWeekplan(recipe, dateStr) {
  const weekStart = getMondayStr(dateStr);
  const existing  = await getWeekPlan(weekStart);
  const DAYS_FULL = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

  const days = (existing?.days?.length === 7)
    ? existing.days.map(d => ({ ...d }))
    : Array.from({ length: 7 }, (_, i) => ({
        date:    addDaysStr(weekStart, i),
        dayName: DAYS_FULL[i],
        recipe:  existing?.days?.[i]?.recipe ?? null,
      }));

  const normalized = {
    name:     recipe.name,
    kcal:     recipe.gesamt_kcal,
    protein:  recipe.protein ?? 0,
    zutaten:  recipe.zutaten ?? [],
    anleitung: recipe.anleitung ?? '',
  };

  const dayObj = days.find(d => d.date === dateStr);
  if (dayObj) dayObj.recipe = normalized;

  await saveWeekPlan(weekStart, {
    weekStart,
    generatedAt: existing?.generatedAt ?? new Date().toISOString(),
    people:      existing?.people ?? 1,
    days,
  });
}

function openDatePickerModal(recipe, onAssign) {
  const today    = new Date();
  const dayNames = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const items    = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return {
      dateStr: d.toISOString().split('T')[0],
      label:   i === 0 ? 'Heute' : i === 1 ? 'Morgen' : dayNames[d.getDay()],
      sub:     `${d.getDate()}.${d.getMonth()+1}.`,
    };
  });

  openModal(box => {
    box.innerHTML += `
      <div class="modal-title">Zum Wochenplan hinzufügen</div>
      <div style="padding:0 20px 20px">
        <div style="font-size:14px;font-weight:600;margin-bottom:2px">${escHtml(recipe.name)}</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:16px">${recipe.gesamt_kcal} kcal</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${items.map(it => `
            <button class="btn btn-ghost date-pick-btn" data-date="${it.dateStr}"
              style="flex-direction:column;gap:2px;padding:10px 4px;font-size:11px;height:auto">
              <span style="font-size:10px;color:var(--text-3)">${it.sub}</span>
              <span style="font-size:13px;font-weight:700">${it.label}</span>
            </button>`).join('')}
        </div>
      </div>`;

    box.querySelectorAll('.date-pick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await onAssign(btn.dataset.date);
        closeModal();
      });
    });
  });
}

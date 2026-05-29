import { generateRecipe }    from '../api.js';
import { getSettings, saveMeal, getSavedMeals, deleteMeal, addShoppingItems } from '../db.js';
import { showToast, navigate } from '../app.js';

const PREFERENCES = [
  { id: 'ausgewogen',  label: 'Ausgewogen' },
  { id: 'low-carb',   label: 'Low-Carb'   },
  { id: 'vegetarisch',label: 'Vegetarisch' },
  { id: 'vegan',      label: 'Vegan'       },
  { id: 'high-protein',label:'High-Protein'},
  { id: 'schnell',    label: '< 30 Min'   },
];

let selectedPref = 'ausgewogen';
let generatedRecipes = [];

export async function renderRecipes(container) {
  const settings = await getSettings();
  const saved    = await getSavedMeals();
  const hasKey   = !!settings.apiKey;

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
        <div style="font-size:14px;color:var(--orange);font-weight:600;margin-bottom:6px">
          ⚠️ API-Key fehlt
        </div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          Für KI-Rezepte benötigst du einen Anthropic API-Key.
          Kostenlos registrieren auf console.anthropic.com.
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-goto-settings">Zu den Einstellungen</button>
      </div>
    </div>` : ''}

    <!-- Generator Form -->
    <div class="section">
      <div class="section-label">Rezept generieren</div>
      <div class="gen-form">
        <div class="gen-row">
          <div class="input-group">
            <label class="input-label">Kalorien-Ziel</label>
            <input id="kcal-input" class="input" type="number" min="100" max="3000"
              value="${settings.dailyGoal}" inputmode="numeric" placeholder="z.B. 600">
          </div>
          <div class="input-group">
            <label class="input-label">Mahlzeiten</label>
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

    <!-- Saved Meals -->
    ${saved.length > 0 ? `
    <div class="section">
      <div class="section-label">Gespeicherte Rezepte (${saved.length})</div>
      <div id="saved-list">
        ${saved.map(m => savedMealCard(m)).join('')}
      </div>
    </div>` : ''}
  `;

  // Events
  container.querySelector('#btn-goto-settings')?.addEventListener('click', () => navigate('settings'));

  container.querySelectorAll('.pill[data-pref]').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedPref = pill.dataset.pref;
      container.querySelectorAll('.pill[data-pref]').forEach(p => p.classList.toggle('active', p.dataset.pref === selectedPref));
    });
  });

  container.querySelector('#btn-generate')?.addEventListener('click', async () => {
    const kcal  = parseInt(container.querySelector('#kcal-input').value) || settings.dailyGoal;
    const meals = parseInt(container.querySelector('#meals-input').value) || 1;
    await runGenerate(container, settings.apiKey, kcal, selectedPref, meals);
  });

  // Saved meal actions (delegated)
  container.querySelector('#saved-list')?.addEventListener('click', async e => {
    const delBtn   = e.target.closest('[data-del-meal]');
    const shopBtn  = e.target.closest('[data-shop-meal]');
    const logBtn   = e.target.closest('[data-log-meal]');

    if (delBtn) {
      await deleteMeal(Number(delBtn.dataset.delMeal));
      showToast('Rezept gelöscht');
      renderRecipes(container);
    }
    if (shopBtn) {
      const meal = (await getSavedMeals()).find(m => m.id === Number(shopBtn.dataset.shopMeal));
      if (meal) {
        await addShoppingItems(meal.ingredients.map(i => ({ name: i.name, amount: `${i.menge} ${i.einheit}` })));
        showToast('Zutaten zur Einkaufsliste hinzugefügt');
        navigate('shopping');
      }
    }
  });
}

async function runGenerate(container, apiKey, kcal, preference, meals) {
  const resultEl = container.querySelector('#recipe-result');
  resultEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>KI generiert Rezept…</span></div>`;

  try {
    const recipes = await generateRecipe(apiKey, { kcal, preference, meals });
    generatedRecipes = recipes;

    resultEl.innerHTML = `
      <div class="section" style="padding-top:0">
        <div class="section-label">Generiertes Rezept</div>
        ${recipes.map((r, i) => recipeCard(r, i)).join('')}
      </div>`;

    resultEl.querySelectorAll('[data-save-recipe]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const recipe = generatedRecipes[Number(btn.dataset.saveRecipe)];
        await saveMeal(recipe);
        showToast('Rezept gespeichert');
        renderRecipes(container);
      });
    });

    resultEl.querySelectorAll('[data-shop-recipe]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const recipe = generatedRecipes[Number(btn.dataset.shopRecipe)];
        await addShoppingItems(recipe.zutaten.map(z => ({ name: z.name, amount: `${z.menge} ${z.einheit}` })));
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
        <button class="btn btn-success btn-sm" style="flex:1" data-shop-recipe="${idx}">
          🛒 Einkaufsliste
        </button>
        <button class="btn btn-ghost btn-sm" style="flex:1" data-save-recipe="${idx}">
          💾 Speichern
        </button>
      </div>
    </div>`;
}

function savedMealCard(meal) {
  return `
    <div class="recipe-card">
      <div class="recipe-header">
        <div class="recipe-title">${escHtml(meal.name)}</div>
        <div class="recipe-kcal-badge">${meal.gesamt_kcal} kcal</div>
      </div>
      <div class="recipe-actions">
        <button class="btn btn-success btn-sm" style="flex:1" data-shop-meal="${meal.id}">
          🛒 Einkaufsliste
        </button>
        <button class="btn btn-danger btn-sm" style="flex:1" data-del-meal="${meal.id}">
          🗑️ Löschen
        </button>
      </div>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

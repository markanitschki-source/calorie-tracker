import { searchFood }        from '../api.js';
import { addFoodEntry }      from '../db.js';
import { openModal, closeModal, showToast, navigate } from '../app.js';

let debounceTimer;

export async function renderFoodLog(container) {
  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Loggen</h1>
        <div class="subtitle">Mahlzeit hinzufügen</div>
      </div>
    </header>

    <div class="section">
      <div class="input-with-btn">
        <input id="search-input" class="input" type="search" placeholder="Produkt suchen (z.B. Banane, Hähnchen...)" autocomplete="off" autocorrect="off" spellcheck="false">
        <button class="btn btn-primary" id="btn-search" style="width:auto;padding:12px 16px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
    </div>

    <div id="search-results" class="section" style="padding-top:0"></div>

    <div class="section">
      <div class="section-label">Schnell hinzufügen</div>
      <div class="card" id="quick-add-list">
        ${quickAddItems.map(item => `
          <div class="search-result" data-quick='${JSON.stringify(item)}'>
            <div class="sr-info">
              <div class="sr-name">${item.name}</div>
              <div class="sr-brand">${item.portion}</div>
            </div>
            <div class="sr-kcal">${item.kcal_100g}<span> kcal/100g</span></div>
          </div>`).join('')}
      </div>
    </div>
  `;

  const input = container.querySelector('#search-input');
  const btn   = container.querySelector('#btn-search');
  const resultsEl = container.querySelector('#search-results');

  const doSearch = async () => {
    const q = input.value.trim();
    if (q.length < 2) return;
    resultsEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Suche in Open Food Facts…</span></div>`;
    try {
      const results = await searchFood(q);
      if (!results.length) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Keine Ergebnisse für „${q}".<br>Andere Schreibweise versuchen.</p></div>`;
        return;
      }
      renderResults(resultsEl, results);
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Fehler: ${err.message}</p></div>`;
    }
  };

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    if (input.value.trim().length >= 3) {
      debounceTimer = setTimeout(doSearch, 600);
    }
  });

  // Quick-add
  container.querySelector('#quick-add-list').addEventListener('click', e => {
    const row = e.target.closest('[data-quick]');
    if (row) openAmountModal(JSON.parse(row.dataset.quick));
  });
}

function renderResults(container, results) {
  container.innerHTML = `
    <div class="section-label" style="padding:0 0 10px">Suchergebnisse (${results.length})</div>
    <div class="card">
      ${results.map(r => `
        <div class="search-result" data-result='${JSON.stringify(r).replace(/'/g,"&#39;")}'>
          <div class="sr-info">
            <div class="sr-name">${escHtml(r.name)}</div>
            <div class="sr-brand">${escHtml(r.brand)}${r.quantity ? ' · ' + escHtml(r.quantity) : ''}</div>
          </div>
          <div class="sr-kcal">${r.kcal_100g}<span> kcal/100g</span></div>
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('.search-result[data-result]').forEach(row => {
    row.addEventListener('click', () => openAmountModal(JSON.parse(row.dataset.result)));
  });
}

function openAmountModal(product) {
  openModal(box => {
    box.innerHTML += `
      <div class="modal-title">Menge eingeben</div>
      <div style="padding:0 20px 16px">
        <div style="margin-bottom:16px">
          <div style="font-size:16px;font-weight:600;margin-bottom:4px">${escHtml(product.name)}</div>
          <div style="font-size:13px;color:var(--text-2)">${product.kcal_100g} kcal pro 100g</div>
        </div>
        <div class="input-group">
          <label class="input-label">Menge (in Gramm)</label>
          <input id="amount-input" class="input" type="number" min="1" max="2000" value="100" inputmode="numeric">
        </div>
        <div id="kcal-preview" style="text-align:center;font-size:22px;font-weight:800;color:var(--accent);margin-bottom:16px">
          ${product.kcal_100g} kcal
        </div>
        <button class="btn btn-primary" id="btn-confirm-add">Zum Tagebuch hinzufügen</button>
      </div>`;

    const amountInput = box.querySelector('#amount-input');
    const preview     = box.querySelector('#kcal-preview');
    const btnConfirm  = box.querySelector('#btn-confirm-add');

    amountInput.select();

    amountInput.addEventListener('input', () => {
      const g = parseFloat(amountInput.value) || 0;
      const kcal = Math.round(product.kcal_100g * g / 100);
      preview.textContent = `${kcal} kcal`;
    });

    btnConfirm.addEventListener('click', async () => {
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) return;
      await addFoodEntry({ ...product, amount });
      closeModal();
      showToast(`${product.name.slice(0, 20)} hinzugefügt`);
      navigate('dashboard');
    });
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const quickAddItems = [
  { name: 'Haferflocken', portion: 'Porridge-Grundlage',       kcal_100g: 370, protein_100g: 13, carbs_100g: 58, fat_100g: 7  },
  { name: 'Ei (Hühnerei)', portion: '1 Ei ≈ 60g',              kcal_100g: 155, protein_100g: 13, carbs_100g: 1,  fat_100g: 11 },
  { name: 'Hähnchenbrustfilet', portion: 'Gebraten / gekocht', kcal_100g: 165, protein_100g: 31, carbs_100g: 0,  fat_100g: 4  },
  { name: 'Vollkornbrot', portion: '1 Scheibe ≈ 50g',          kcal_100g: 240, protein_100g: 8,  carbs_100g: 42, fat_100g: 3  },
  { name: 'Apfel',        portion: 'Mittelgroß ≈ 150g',        kcal_100g: 52,  protein_100g: 0.3,carbs_100g: 14, fat_100g: 0.2},
  { name: 'Naturjoghurt', portion: '3,5% Fett',                kcal_100g: 61,  protein_100g: 4,  carbs_100g: 4,  fat_100g: 4  },
  { name: 'Lachs',        portion: 'Filet',                    kcal_100g: 208, protein_100g: 20, carbs_100g: 0,  fat_100g: 13 },
  { name: 'Reis (gekocht)', portion: 'Basmati / Langkorn',     kcal_100g: 130, protein_100g: 3,  carbs_100g: 28, fat_100g: 0.3},
];

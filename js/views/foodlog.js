import { searchFood, lookupBarcode } from '../api.js';
import { addFoodEntry }              from '../db.js';
import { openModal, closeModal, showToast, navigate } from '../app.js';

let debounceTimer;

const MEAL_TYPES = [
  { key: 'fruehstueck', label: 'Frühstück',  icon: '🌅' },
  { key: 'mittagessen', label: 'Mittagessen', icon: '☀️' },
  { key: 'abendessen',  label: 'Abendessen',  icon: '🌙' },
  { key: 'snack',       label: 'Snack',       icon: '🍎' },
];

export async function renderFoodLog(container) {
  const preselected = window._preselectedMeal ?? 'fruehstueck';
  window._preselectedMeal = null;

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Tracken</h1>
        <div class="subtitle">Mahlzeit hinzufügen</div>
      </div>
    </header>

    <!-- Mahlzeit wählen -->
    <div class="section">
      <div class="section-label">Für welche Mahlzeit?</div>
      <div class="pill-tabs" style="padding:0 0 4px">
        ${MEAL_TYPES.map(m => `
          <button class="pill meal-pill ${m.key === preselected ? 'active' : ''}" data-meal="${m.key}">
            ${m.icon} ${m.label}
          </button>`).join('')}
      </div>
    </div>

    <!-- Suche + Scanner -->
    <div class="section" style="padding-top:0">
      <button class="btn btn-primary" id="btn-scan" style="margin-bottom:10px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        📷 Barcode scannen
      </button>
      <div class="input-with-btn">
        <input id="search-input" class="input" type="search"
          placeholder="Produkt suchen (z.B. Banane, Hähnchen…)"
          autocomplete="off" autocorrect="off" spellcheck="false">
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

  let selectedMeal = preselected;

  container.querySelectorAll('.meal-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedMeal = pill.dataset.meal;
      container.querySelectorAll('.meal-pill').forEach(p => p.classList.toggle('active', p.dataset.meal === selectedMeal));
    });
  });

  const input     = container.querySelector('#search-input');
  const btnSearch = container.querySelector('#btn-search');
  const btnScan   = container.querySelector('#btn-scan');
  const resultsEl = container.querySelector('#search-results');

  const doSearch = async () => {
    const q = input.value.trim();
    if (q.length < 2) return;
    resultsEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Suche in Open Food Facts…</span></div>`;
    try {
      const results = await searchFood(q);
      if (!results.length) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Keine Ergebnisse für „${escHtml(q)}".<br>Andere Schreibweise versuchen.</p></div>`;
        return;
      }
      renderResults(resultsEl, results, () => selectedMeal);
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Fehler: ${escHtml(err.message)}</p></div>`;
    }
  };

  btnSearch.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    if (input.value.trim().length >= 3) debounceTimer = setTimeout(doSearch, 600);
  });

  btnScan.addEventListener('click', () => openScannerModal(resultsEl, () => selectedMeal));

  container.querySelector('#quick-add-list').addEventListener('click', e => {
    const row = e.target.closest('[data-quick]');
    if (row) openAmountModal(JSON.parse(row.dataset.quick), () => selectedMeal);
  });
}

// ── Barcode Scanner ───────────────────────────────────────
function openScannerModal(resultsEl, getMeal) {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Kamera nicht verfügbar');
    return;
  }

  openModal(box => {
    box.innerHTML += `
      <div class="modal-title">📷 Barcode scannen</div>
      <div style="padding:0 20px 16px">
        <div style="position:relative;background:#000;border-radius:12px;overflow:hidden;margin-bottom:14px;aspect-ratio:4/3">
          <video id="scanner-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
            <div style="width:65%;aspect-ratio:3/1;border:2px solid var(--accent);border-radius:6px;box-shadow:0 0 0 9999px rgba(0,0,0,0.45)"></div>
          </div>
          <div id="scan-status" style="position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:13px;color:#fff;text-shadow:0 1px 3px #000">
            Barcode in den Rahmen halten…
          </div>
        </div>
        <button class="btn btn-ghost" id="btn-cancel-scan" style="width:100%">Abbrechen</button>
      </div>`;

    const video    = box.querySelector('#scanner-video');
    const statusEl = box.querySelector('#scan-status');
    let stream     = null;
    let scanning   = true;
    let animFrame;

    const stopScan = () => {
      scanning = false;
      cancelAnimationFrame(animFrame);
      stream?.getTracks().forEach(t => t.stop());
    };

    box.querySelector('#btn-cancel-scan').addEventListener('click', () => { stopScan(); closeModal(); });
    document.getElementById('modal-overlay').addEventListener('click', stopScan, { once: true });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s;
        video.srcObject = s;
        video.play();

        if ('BarcodeDetector' in window) {
          const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39'] });
          const scan = async () => {
            if (!scanning) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                stopScan();
                await handleBarcode(codes[0].rawValue, resultsEl, getMeal);
                closeModal();
                return;
              }
            } catch (_) {}
            animFrame = requestAnimationFrame(scan);
          };
          video.addEventListener('loadeddata', scan, { once: true });
        } else {
          statusEl.textContent = 'BarcodeDetector nicht unterstützt — bitte manuell suchen';
        }
      })
      .catch(() => { statusEl.textContent = '⚠️ Kamera-Zugriff verweigert'; });
  });
}

async function handleBarcode(barcode, resultsEl, getMeal) {
  resultsEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Produkt wird gesucht…</span></div>`;
  try {
    const product = await lookupBarcode(barcode);
    renderResults(resultsEl, [product], getMeal);
    showToast('Produkt gefunden!');
  } catch {
    resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>Produkt nicht gefunden.<br>Bitte manuell suchen.</p></div>`;
  }
}

// ── Search Results ────────────────────────────────────────
function renderResults(container, results, getMeal) {
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
    row.addEventListener('click', () => openAmountModal(JSON.parse(row.dataset.result), getMeal));
  });
}

// ── Amount Modal ──────────────────────────────────────────
function openAmountModal(product, getMeal) {
  openModal(box => {
    const meal = MEAL_TYPES.find(m => m.key === getMeal()) ?? MEAL_TYPES[0];
    box.innerHTML += `
      <div class="modal-title">Menge eingeben</div>
      <div style="padding:0 20px 16px">
        <div style="margin-bottom:16px">
          <div style="font-size:16px;font-weight:600;margin-bottom:4px">${escHtml(product.name)}</div>
          <div style="font-size:13px;color:var(--text-2)">${product.kcal_100g} kcal/100g · ${meal.icon} ${meal.label}</div>
        </div>
        <div class="input-group">
          <label class="input-label">Menge (in Gramm)</label>
          <input id="amount-input" class="input" type="number" min="1" max="2000" value="100" inputmode="numeric">
        </div>
        <div id="kcal-preview" style="text-align:center;font-size:22px;font-weight:800;color:var(--accent);margin-bottom:16px">
          ${product.kcal_100g} kcal
        </div>
        <button class="btn btn-primary" id="btn-confirm-add">Zum Tracker hinzufügen</button>
      </div>`;

    const amountInput = box.querySelector('#amount-input');
    const preview     = box.querySelector('#kcal-preview');

    amountInput.select();
    amountInput.addEventListener('input', () => {
      const g = parseFloat(amountInput.value) || 0;
      preview.textContent = `${Math.round(product.kcal_100g * g / 100)} kcal`;
    });

    box.querySelector('#btn-confirm-add').addEventListener('click', async () => {
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) return;
      await addFoodEntry({ ...product, amount, meal_type: getMeal() });
      closeModal();
      showToast(`${product.name.slice(0, 20)} getrackt`);
      navigate('dashboard');
    });
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const quickAddItems = [
  { name: 'Haferflocken',       portion: 'Porridge-Grundlage',  kcal_100g: 370, protein_100g: 13,  carbs_100g: 58, fat_100g: 7   },
  { name: 'Ei (Hühnerei)',      portion: '1 Ei ≈ 60g',          kcal_100g: 155, protein_100g: 13,  carbs_100g: 1,  fat_100g: 11  },
  { name: 'Hähnchenbrustfilet', portion: 'Gebraten / gekocht',  kcal_100g: 165, protein_100g: 31,  carbs_100g: 0,  fat_100g: 4   },
  { name: 'Vollkornbrot',       portion: '1 Scheibe ≈ 50g',     kcal_100g: 240, protein_100g: 8,   carbs_100g: 42, fat_100g: 3   },
  { name: 'Apfel',              portion: 'Mittelgroß ≈ 150g',   kcal_100g: 52,  protein_100g: 0.3, carbs_100g: 14, fat_100g: 0.2 },
  { name: 'Naturjoghurt',       portion: '3,5% Fett',           kcal_100g: 61,  protein_100g: 4,   carbs_100g: 4,  fat_100g: 4   },
  { name: 'Lachs',              portion: 'Filet',               kcal_100g: 208, protein_100g: 20,  carbs_100g: 0,  fat_100g: 13  },
  { name: 'Reis (gekocht)',     portion: 'Basmati / Langkorn',  kcal_100g: 130, protein_100g: 3,   carbs_100g: 28, fat_100g: 0.3 },
];

import { searchFood, lookupBarcode } from '../api.js';
import { addFoodEntry, getFoodHistory, updateFoodHistory } from '../db.js';
import { openModal, closeModal, showToast, navigate } from '../app.js';
import { searchLocal } from '../search.js';

let debounceTimer;

const MEAL_TYPES = [
  { key: 'fruehstueck', label: 'Frühstück',  icon: '🌅' },
  { key: 'mittagessen', label: 'Mittagessen', icon: '☀️' },
  { key: 'abendessen',  label: 'Abendessen',  icon: '🌙' },
  { key: 'snack',       label: 'Snack',       icon: '🍎' },
  { key: 'getraenke',   label: 'Getränke',    icon: '🥤' },
];

const QUICK_AMOUNTS = [30, 50, 100, 150, 200, 300];

export async function renderFoodLog(container) {
  const preselected = window._preselectedMeal ?? 'fruehstueck';
  window._preselectedMeal = null;

  const history    = await getFoodHistory();
  const hasHistory = history.length > 0;
  const topItems   = hasHistory ? history.slice(0, 8) : quickAddItems;

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Tracken</h1>
        <div class="subtitle">Mahlzeit hinzufügen</div>
      </div>
    </header>

    <div class="section">
      <div class="section-label">Für welche Mahlzeit?</div>
      <div class="pill-tabs" style="padding:0 0 4px;flex-wrap:wrap">
        ${MEAL_TYPES.map(m => `
          <button class="pill meal-pill ${m.key === preselected ? 'active' : ''}" data-meal="${m.key}">
            ${m.icon} ${m.label}
          </button>`).join('')}
      </div>
    </div>

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
          placeholder="Produkt oder Marke suchen…"
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
      <div class="section-label">${hasHistory ? 'Häufig verwendet' : 'Schnell hinzufügen'}</div>
      <div class="card" id="quick-list">
        ${topItems.map(item => quickRow(item)).join('')}
      </div>
    </div>

    ${hasHistory ? `
    <div class="section" style="padding-top:0">
      <details>
        <summary style="cursor:pointer;padding:8px 0;font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;list-style:none">
          ▸ Basis-Lebensmittel
        </summary>
        <div class="card" id="quick-basics" style="margin-top:8px">
          ${quickAddItems.map(item => quickRow(item)).join('')}
        </div>
      </details>
    </div>` : ''}

    <div class="section" style="padding-top:0">
      <details>
        <summary style="cursor:pointer;padding:8px 0;font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;list-style:none">
          ▸ 🥤 Getränke (Schnellzugriff)
        </summary>
        <div class="card" id="quick-drinks" style="margin-top:8px">
          ${quickDrinkItems.map(item => quickRow(item)).join('')}
        </div>
      </details>
    </div>
  `;

  let selectedMeal = preselected;

  container.querySelectorAll('.meal-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedMeal = pill.dataset.meal;
      container.querySelectorAll('.meal-pill').forEach(p =>
        p.classList.toggle('active', p.dataset.meal === selectedMeal));
    });
  });

  const input     = container.querySelector('#search-input');
  const btnSearch = container.querySelector('#btn-search');
  const btnScan   = container.querySelector('#btn-scan');
  const resultsEl = container.querySelector('#search-results');

  const showLocalMatches = q => {
    const matches = searchLocal(q);
    if (!matches.length) return false;
    renderResults(resultsEl, matches, () => selectedMeal);
    return true;
  };

  const doSearch = async () => {
    const q = input.value.trim();
    if (q.length < 2) return;

    const localMatches = searchLocal(q);
    if (localMatches.length) renderResults(resultsEl, localMatches, () => selectedMeal);

    // OFF nur als Fallback — wenn lokale DB < 5 Treffer hat
    if (localMatches.length >= 5) return;

    if (!localMatches.length) {
      resultsEl.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Suche…</span></div>`;
    }

    try {
      const apiResults = await searchFood(q);
      if (input.value.trim() !== q) return; // stale guard
      if (!apiResults.length && !localMatches.length) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Keine Ergebnisse für „${escHtml(q)}".<br>Andere Schreibweise versuchen.</p></div>`;
        return;
      }
      if (apiResults.length) {
        // Merge: lokale zuerst, API ergänzt (dedup by name)
        const seen = new Set(localMatches.map(f => f.name.toLowerCase()));
        const merged = [...localMatches, ...apiResults.filter(f => !seen.has(f.name.toLowerCase()))];
        renderResults(resultsEl, merged, () => selectedMeal);
      }
    } catch {
      if (!localMatches.length) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>Keine Verbindung.</p></div>`;
      }
    }
  };

  btnSearch.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    if (q.length >= 2) {
      showLocalMatches(q);
      debounceTimer = setTimeout(doSearch, 500);
    } else {
      resultsEl.innerHTML = '';
    }
  });

  btnScan.addEventListener('click', () => openScannerModal(resultsEl, () => selectedMeal));

  container.querySelector('#quick-list').addEventListener('click', e => {
    const row = e.target.closest('[data-quick]');
    if (row) openAmountModal(JSON.parse(row.dataset.quick), () => selectedMeal);
  });

  container.querySelector('#quick-basics')?.addEventListener('click', e => {
    const row = e.target.closest('[data-quick]');
    if (row) openAmountModal(JSON.parse(row.dataset.quick), () => selectedMeal);
  });

  container.querySelector('#quick-drinks')?.addEventListener('click', e => {
    const row = e.target.closest('[data-quick]');
    if (row) openAmountModal(JSON.parse(row.dataset.quick), () => selectedMeal);
  });
}

function quickRow(item) {
  const safe = JSON.stringify(item).replace(/'/g, "&#39;");
  let sub;
  if (item.count) {
    const brand = item.brand ? escHtml(item.brand) + ' · ' : '';
    sub = `${brand}${item.count}× verwendet`;
  } else {
    sub = item.portion ?? (item.brand ? escHtml(item.brand) : '');
  }
  return `
    <div class="search-result" data-quick='${safe}'>
      <div class="sr-info">
        <div class="sr-name">${escHtml(item.name)}</div>
        <div class="sr-brand">${sub}</div>
      </div>
      <div class="sr-kcal">${item.kcal_100g}<span> kcal/100g</span></div>
    </div>`;
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
      .then(async s => {
        stream = s;
        video.srcObject = s;
        video.play();

        if (!('BarcodeDetector' in window)) {
          try {
            const mod = await import('https://cdn.jsdelivr.net/npm/@undecaf/barcode-detector-polyfill@0.9.21/dist/es/index.js');
            window.BarcodeDetector = mod.BarcodeDetectorPolyfill;
          } catch {
            statusEl.textContent = 'Scanner nicht unterstützt — bitte manuell suchen';
            return;
          }
        }

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
      ${results.map(r => {
        const meta    = [r.brand, r.quantity].filter(Boolean).map(escHtml).join(' · ');
        const serving = r.serving_quantity
          ? `<span style="color:var(--accent)"> · ${r.serving_quantity}g Portion</span>` : '';
        return `
        <div class="search-result" data-result='${JSON.stringify(r).replace(/'/g,"&#39;")}'>
          <div class="sr-info">
            <div class="sr-name">${escHtml(r.name)}</div>
            <div class="sr-brand">${meta}${serving}</div>
          </div>
          <div class="sr-kcal">${r.kcal_100g}<span> kcal/100g</span></div>
        </div>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('.search-result[data-result]').forEach(row => {
    row.addEventListener('click', () => openAmountModal(JSON.parse(row.dataset.result), getMeal));
  });
}

// ── Amount Modal ──────────────────────────────────────────
function openAmountModal(product, getMeal) {
  openModal(box => {
    const meal          = MEAL_TYPES.find(m => m.key === getMeal()) ?? MEAL_TYPES[0];
    const defaultAmount = product.serving_quantity ?? 100;
    const quickAmounts  = product.serving_quantity
      ? QUICK_AMOUNTS.filter(g => g !== product.serving_quantity)
      : QUICK_AMOUNTS;

    const portionBtn = product.serving_quantity
      ? `<button class="pill active" data-amount="${product.serving_quantity}" style="font-size:12px">${product.serving_quantity}g Portion</button>`
      : '';

    box.innerHTML += `
      <div class="modal-title">Menge eingeben</div>
      <div style="padding:0 20px 16px">
        <div style="margin-bottom:12px">
          <div style="font-size:16px;font-weight:600;margin-bottom:2px">${escHtml(product.name)}</div>
          <div style="font-size:13px;color:var(--text-2)">${product.kcal_100g} kcal/100g${product.brand ? ' · ' + escHtml(product.brand) : ''}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">${meal.icon} ${meal.label}</div>
        </div>
        <div class="pill-tabs" style="flex-wrap:wrap;gap:6px;margin-bottom:12px;padding:0">
          ${portionBtn}
          ${quickAmounts.map(g =>
            `<button class="pill ${!product.serving_quantity && g === 100 ? 'active' : ''}" data-amount="${g}" style="font-size:12px">${g}g</button>`
          ).join('')}
        </div>
        <div class="input-group">
          <label class="input-label">Exakte Menge (Gramm)</label>
          <input id="amount-input" class="input" type="number" min="1" max="2000"
            value="${defaultAmount}" inputmode="numeric">
        </div>
        <div id="kcal-preview" style="text-align:center;font-size:22px;font-weight:800;color:var(--accent);margin-bottom:16px">
          ${Math.round(product.kcal_100g * defaultAmount / 100)} kcal
        </div>
        <button class="btn btn-primary" id="btn-confirm-add">Zum Tracker hinzufügen</button>
      </div>`;

    const amountInput = box.querySelector('#amount-input');
    const preview     = box.querySelector('#kcal-preview');
    const pills       = box.querySelectorAll('[data-amount]');

    const updatePreview = () => {
      const g = parseFloat(amountInput.value) || 0;
      preview.textContent = `${Math.round(product.kcal_100g * g / 100)} kcal`;
    };

    pills.forEach(btn => {
      btn.addEventListener('click', () => {
        amountInput.value = btn.dataset.amount;
        updatePreview();
        pills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    amountInput.addEventListener('input', () => {
      updatePreview();
      pills.forEach(b => b.classList.remove('active'));
    });
    amountInput.select();

    box.querySelector('#btn-confirm-add').addEventListener('click', async () => {
      const amount = parseFloat(amountInput.value);
      if (!amount || amount <= 0) return;
      const { count, lastUsed, ...cleanProduct } = product;
      await addFoodEntry({ ...cleanProduct, amount, meal_type: getMeal() });
      await updateFoodHistory(cleanProduct);
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
  { name: 'Haferflocken',       portion: '1 Portion ≈ 60g',     kcal_100g: 370, protein_100g: 13,  carbs_100g: 58, fat_100g: 7,   serving_quantity: 60  },
  { name: 'Ei (Hühnerei)',      portion: '1 Ei ≈ 60g',          kcal_100g: 155, protein_100g: 13,  carbs_100g: 1,  fat_100g: 11,  serving_quantity: 60  },
  { name: 'Hähnchenbrustfilet', portion: 'Gebraten / gekocht',  kcal_100g: 165, protein_100g: 31,  carbs_100g: 0,  fat_100g: 4,   serving_quantity: 150 },
  { name: 'Vollkornbrot',       portion: '1 Scheibe ≈ 50g',     kcal_100g: 240, protein_100g: 8,   carbs_100g: 42, fat_100g: 3,   serving_quantity: 50  },
  { name: 'Apfel',              portion: 'Mittelgroß ≈ 150g',   kcal_100g: 52,  protein_100g: 0.3, carbs_100g: 14, fat_100g: 0.2, serving_quantity: 150 },
  { name: 'Naturjoghurt 3,5%',  portion: '1 Glas ≈ 200g',      kcal_100g: 61,  protein_100g: 4,   carbs_100g: 4,  fat_100g: 4,   serving_quantity: 200 },
  { name: 'Lachs',              portion: 'Filet ≈ 150g',        kcal_100g: 208, protein_100g: 20,  carbs_100g: 0,  fat_100g: 13,  serving_quantity: 150 },
  { name: 'Reis (gekocht)',     portion: 'Basmati / Langkorn',  kcal_100g: 130, protein_100g: 3,   carbs_100g: 28, fat_100g: 0.3, serving_quantity: 200 },
];


const quickDrinkItems = [
  { name: 'Kaffee schwarz',     portion: '1 Tasse ≈ 200ml',     kcal_100g: 2,   protein_100g: 0.1, carbs_100g: 0,  fat_100g: 0   },
  { name: 'Kaffee mit Milch',   portion: 'Cappuccino ca. 150ml', kcal_100g: 40,  protein_100g: 2,   carbs_100g: 4,  fat_100g: 1.5 },
  { name: 'Tee (ungesüßt)',     portion: '1 Tasse ≈ 200ml',     kcal_100g: 1,   protein_100g: 0,   carbs_100g: 0,  fat_100g: 0   },
  { name: 'Orangensaft',        portion: 'Frisch gepresst',      kcal_100g: 45,  protein_100g: 0.7, carbs_100g: 10, fat_100g: 0.2 },
  { name: 'Apfelsaft',          portion: '100% Saft',            kcal_100g: 46,  protein_100g: 0.1, carbs_100g: 11, fat_100g: 0.1 },
  { name: 'Vollmilch',          portion: '3,5% Fett',            kcal_100g: 64,  protein_100g: 3.3, carbs_100g: 4.7,fat_100g: 3.5 },
  { name: 'Cola',               portion: 'z.B. Coca-Cola',       kcal_100g: 42,  protein_100g: 0,   carbs_100g: 10.6,fat_100g: 0  },
  { name: 'Cola Zero / Light',  portion: 'Zuckerfrei',           kcal_100g: 0,   protein_100g: 0,   carbs_100g: 0,  fat_100g: 0   },
  { name: 'Bier (5%)',          portion: '0,5L = 500ml',         kcal_100g: 43,  protein_100g: 0.5, carbs_100g: 3.6,fat_100g: 0   },
  { name: 'Rotwein',            portion: '1 Glas ≈ 150ml',       kcal_100g: 85,  protein_100g: 0.1, carbs_100g: 2.6,fat_100g: 0   },
  { name: 'Weißwein',           portion: '1 Glas ≈ 150ml',       kcal_100g: 82,  protein_100g: 0.1, carbs_100g: 2.6,fat_100g: 0   },
  { name: 'Energydrink',        portion: 'z.B. Red Bull 250ml',  kcal_100g: 45,  protein_100g: 0,   carbs_100g: 11, fat_100g: 0   },
];

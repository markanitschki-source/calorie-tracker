import { getShoppingList, saveShoppingList, toggleShoppingItem, deleteShoppingItem, categorize } from '../db.js';
import { showToast } from '../app.js';

const CAT_ORDER = ['fleisch', 'gemüse', 'obst', 'milch', 'getreide', 'vorrat', 'sonstiges'];
const CAT_META  = {
  fleisch:   { label: 'Fleisch & Fisch',   icon: '🥩' },
  gemüse:    { label: 'Gemüse',             icon: '🥦' },
  obst:      { label: 'Obst',               icon: '🍎' },
  milch:     { label: 'Milch & Eier',       icon: '🥛' },
  getreide:  { label: 'Getreide & Brot',    icon: '🌾' },
  vorrat:    { label: 'Vorrat & Gewürze',   icon: '🥫' },
  sonstiges: { label: 'Sonstiges',          icon: '🛒' },
};

export async function renderShopping(container) {
  await paint(container);
}

async function paint(container) {
  const items     = await getShoppingList();
  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i => i.checked);

  // Group unchecked by category
  const grouped = {};
  for (const item of unchecked) {
    const cat = item.category ?? categorize(item.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const activeCats = CAT_ORDER.filter(cat => (grouped[cat] ?? []).length > 0);

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Einkaufsliste</h1>
        <div class="subtitle">${unchecked.length} offen · ${checked.length} erledigt</div>
      </div>
      ${checked.length > 0 ? `
      <button class="btn btn-ghost btn-sm" id="btn-clear-done">Erledigte löschen</button>` : ''}
    </header>

    <!-- Manuell hinzufügen -->
    <div class="section">
      <div class="input-with-btn">
        <input id="manual-input" class="input" type="text"
          placeholder="Artikel hinzufügen…" autocomplete="off">
        <button class="btn btn-primary" id="btn-add-manual" style="width:auto;padding:12px 14px">+</button>
      </div>
    </div>

    <!-- Aktionen -->
    ${items.length > 0 ? `
    <div class="section" style="padding-top:0;display:flex;gap:8px">
      <button class="btn btn-success btn-sm" id="btn-whatsapp" style="flex:1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        WhatsApp teilen
      </button>
      <button class="btn btn-danger btn-sm" id="btn-clear-all">Alle löschen</button>
    </div>` : ''}

    <!-- Liste nach Kategorien -->
    <div class="section" style="padding-top:0">
      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <p>Noch keine Artikel.<br>Füge Artikel manuell hinzu<br>oder generiere ein Rezept.</p>
        </div>` : `
        <div class="card" id="shop-list">
          ${activeCats.map(cat => {
            const { label, icon } = CAT_META[cat];
            return `
              <div class="shop-category-header">${icon} ${label}</div>
              ${(grouped[cat] ?? []).map(i => shopRow(i)).join('')}`;
          }).join('')}
          ${checked.length > 0 ? `
            <div style="padding:8px 16px;font-size:12px;color:var(--text-3);border-top:1px solid var(--border);margin-top:4px">
              ✓ Erledigt
            </div>
            ${checked.map(i => shopRow(i)).join('')}
          ` : ''}
        </div>`}
    </div>
  `;

  const list = container.querySelector('#shop-list');

  list?.addEventListener('change', async e => {
    if (e.target.classList.contains('shop-checkbox')) {
      await toggleShoppingItem(Number(e.target.dataset.id));
      await paint(container);
    }
  });

  list?.addEventListener('click', async e => {
    const del = e.target.closest('.shop-item-del');
    if (del) {
      await deleteShoppingItem(Number(del.dataset.id));
      showToast('Artikel gelöscht');
      await paint(container);
    }
  });

  container.querySelector('#btn-clear-done')?.addEventListener('click', async () => {
    await saveShoppingList((await getShoppingList()).filter(i => !i.checked));
    showToast('Erledigte gelöscht');
    await paint(container);
  });

  container.querySelector('#btn-clear-all')?.addEventListener('click', async () => {
    if (!confirm('Gesamte Liste löschen?')) return;
    await saveShoppingList([]);
    showToast('Liste geleert');
    await paint(container);
  });

  container.querySelector('#btn-whatsapp')?.addEventListener('click', async () => {
    const all  = await getShoppingList();
    const open = all.filter(i => !i.checked);
    if (!open.length) { showToast('Keine offenen Artikel'); return; }

    const grp = {};
    for (const item of open) {
      const cat = item.category ?? categorize(item.name);
      if (!grp[cat]) grp[cat] = [];
      grp[cat].push(item);
    }

    let text = '🛒 *Einkaufsliste*';
    for (const cat of CAT_ORDER) {
      if (!(grp[cat]?.length)) continue;
      const { icon, label } = CAT_META[cat];
      text += `\n\n*${icon} ${label}*\n`;
      text += grp[cat].map(i => `• ${i.name}${i.amount ? ' (' + i.amount + ')' : ''}`).join('\n');
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  });

  const manualInput = container.querySelector('#manual-input');
  const btnAdd      = container.querySelector('#btn-add-manual');

  const addManual = async () => {
    const name = manualInput.value.trim();
    if (!name) return;
    const current = await getShoppingList();
    current.push({ id: Date.now(), name, amount: '', checked: false, category: categorize(name) });
    await saveShoppingList(current);
    manualInput.value = '';
    showToast(`„${name}" hinzugefügt`);
    await paint(container);
  };

  btnAdd.addEventListener('click', addManual);
  manualInput.addEventListener('keydown', e => { if (e.key === 'Enter') addManual(); });
}

function shopRow(item) {
  return `
    <div class="shop-item ${item.checked ? 'checked' : ''}">
      <input type="checkbox" class="shop-checkbox" data-id="${item.id}"
        ${item.checked ? 'checked' : ''} aria-label="${escHtml(item.name)}">
      <div class="shop-item-text">${escHtml(item.name)}</div>
      ${item.amount ? `<div class="shop-item-amount">${escHtml(item.amount)}</div>` : ''}
      <button class="shop-item-del" data-id="${item.id}" title="Löschen">✕</button>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

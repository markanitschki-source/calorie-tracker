import { getShoppingList, saveShoppingList, toggleShoppingItem, deleteShoppingItem } from '../db.js';
import { showToast } from '../app.js';

export async function renderShopping(container) {
  await paint(container);
}

async function paint(container) {
  const items = await getShoppingList();
  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i => i.checked);

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Einkaufsliste</h1>
        <div class="subtitle">${unchecked.length} offen · ${checked.length} erledigt</div>
      </div>
      ${items.length > 0 ? `
      <button class="btn btn-ghost btn-sm" id="btn-clear-done">Erledigte löschen</button>` : ''}
    </header>

    <!-- Add manually -->
    <div class="section">
      <div class="input-with-btn">
        <input id="manual-input" class="input" type="text" placeholder="Artikel manuell hinzufügen…" autocomplete="off">
        <button class="btn btn-primary" id="btn-add-manual" style="width:auto;padding:12px 14px">+</button>
      </div>
    </div>

    <!-- Items -->
    <div class="section" style="padding-top:0">
      ${items.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <p>Noch keine Artikel.<br>Füge Artikel manuell hinzu<br>oder generiere ein Rezept.</p>
        </div>` : `
        <div class="card" id="shop-list">
          ${unchecked.map(i => shopRow(i)).join('')}
          ${checked.length > 0 && unchecked.length > 0 ? `<div style="padding:8px 16px;font-size:12px;color:var(--text-3);border-top:1px solid var(--border)">Erledigt</div>` : ''}
          ${checked.map(i => shopRow(i)).join('')}
        </div>`}
    </div>

    ${items.length > 0 ? `
    <div class="section" style="padding-top:0">
      <button class="btn btn-danger btn-sm" style="width:100%" id="btn-clear-all">
        Gesamte Liste löschen
      </button>
    </div>` : ''}
  `;

  const list = container.querySelector('#shop-list');

  // Toggle checkbox
  list?.addEventListener('change', async e => {
    if (e.target.classList.contains('shop-checkbox')) {
      const id = Number(e.target.dataset.id);
      await toggleShoppingItem(id);
      await paint(container);
    }
  });

  // Delete item
  list?.addEventListener('click', async e => {
    const delBtn = e.target.closest('.shop-item-del');
    if (delBtn) {
      const id = Number(delBtn.dataset.id);
      await deleteShoppingItem(id);
      showToast('Artikel gelöscht');
      await paint(container);
    }
  });

  // Clear done
  container.querySelector('#btn-clear-done')?.addEventListener('click', async () => {
    const items = await getShoppingList();
    await saveShoppingList(items.filter(i => !i.checked));
    showToast('Erledigte gelöscht');
    await paint(container);
  });

  // Clear all
  container.querySelector('#btn-clear-all')?.addEventListener('click', async () => {
    if (!confirm('Gesamte Liste löschen?')) return;
    await saveShoppingList([]);
    showToast('Liste geleert');
    await paint(container);
  });

  // Add manual
  const manualInput = container.querySelector('#manual-input');
  const btnAdd      = container.querySelector('#btn-add-manual');

  const addManual = async () => {
    const name = manualInput.value.trim();
    if (!name) return;
    const items = await getShoppingList();
    items.push({ id: Date.now(), name, amount: '', checked: false });
    await saveShoppingList(items);
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
      <input type="checkbox" class="shop-checkbox" data-id="${item.id}" ${item.checked ? 'checked' : ''} aria-label="${escHtml(item.name)}">
      <div class="shop-item-text">${escHtml(item.name)}</div>
      ${item.amount ? `<div class="shop-item-amount">${escHtml(item.amount)}</div>` : ''}
      <button class="shop-item-del" data-id="${item.id}" title="Löschen">✕</button>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

import { getSettings, saveSettings, PHASES, getProfiles, saveProfiles } from '../db.js';
import { showToast, refresh, openModal, closeModal } from '../app.js';

let selectedPhase = 'ausgewogen';

export async function renderSettings(container) {
  const [settings, profiles] = await Promise.all([getSettings(), getProfiles()]);
  selectedPhase = settings.phase ?? 'ausgewogen';
  const total   = (settings.dailyGoal ?? 2000) + (settings.activityKcal ?? 0);
  const phase   = PHASES.find(p => p.id === selectedPhase) ?? PHASES[0];
  const routine = settings.routine ?? [];

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Einstellungen</h1>
        <div class="subtitle">App konfigurieren</div>
      </div>
    </header>

    <!-- Familien-Profile -->
    <div class="section">
      <div class="section-label">Familien-Profile</div>
      <div class="card">
        ${profiles.map(p => `
          <div class="card-row">
            <div class="card-icon" style="background:${p.color}22;color:${p.color};font-size:22px;border-radius:50%;flex-shrink:0">
              ${p.emoji}
            </div>
            <div class="card-body">
              <div class="card-title">${escHtml(p.name)}</div>
              <div class="card-subtitle" style="font-size:11px;opacity:.6">ID: ${p.id}</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-edit-profile="${p.id}"
              style="flex-shrink:0;padding:6px 10px">✏️ Bearbeiten</button>
          </div>`).join('')}
      </div>
    </div>

    <!-- Ernährungsphase -->
    <div class="section" style="padding-top:0">
      <div class="section-label">Ernährungsphase</div>
      <div class="card">
        <div style="padding:12px 12px 0">
          <div class="pill-tabs" style="flex-wrap:wrap;gap:6px">
            ${PHASES.map(p => `
              <button class="pill ${p.id === selectedPhase ? 'active' : ''}" data-phase="${p.id}" style="font-size:13px">
                ${p.label}
              </button>`).join('')}
          </div>
        </div>
        <div id="phase-details" style="padding:10px 14px 14px">
          ${phaseDetails(phase)}
        </div>
      </div>
    </div>

    <!-- Kalorienziel -->
    <div class="section" style="padding-top:0">
      <div class="section-label">Kalorienziel & Verbrauch</div>
      <div class="card">
        <div class="settings-row">
          <label class="settings-label" for="goal-input">Grundumsatz / Tagesziel (kcal)</label>
          <input id="goal-input" class="input" type="number" min="500" max="10000"
            value="${settings.dailyGoal}" inputmode="numeric" placeholder="2000">
          <div class="settings-hint">Dein tägliches Kalorienziel ohne Sport. Empfehlung: 1800–2500 kcal.</div>
        </div>
        <div class="settings-row">
          <label class="settings-label" for="activity-input">Aktivitätskalorien (kcal)</label>
          <input id="activity-input" class="input" type="number" min="0" max="5000"
            value="${settings.activityKcal ?? 0}" inputmode="numeric" placeholder="0">
          <div class="settings-hint">Zusätzlich verbrannte Kalorien durch Sport. Erhöht dein Tagesbudget.</div>
        </div>
        <div class="settings-row" style="background:var(--accent-dim);border-radius:var(--radius-sm)">
          <div class="settings-label">Gesamtbudget heute</div>
          <div id="total-display" style="font-size:26px;font-weight:800;color:var(--accent)">${total} kcal</div>
          <div class="settings-hint" id="meal-split-display">${mealSplitText(total)}</div>
        </div>
        <div class="settings-row">
          <label class="settings-label" for="water-goal-input">Wasserziel pro Tag (ml)</label>
          <input id="water-goal-input" class="input" type="number" min="500" max="6000"
            value="${settings.waterGoalMl ?? 2500}" inputmode="numeric" placeholder="2500">
        </div>
      </div>
    </div>

    <!-- Tägliche Routine -->
    <div class="section" style="padding-top:0">
      <div class="section-label">⚡ Tägliche Routine</div>
      <div class="card">
        ${routine.length === 0 ? `
          <div style="padding:14px;font-size:13px;color:var(--text-3);text-align:center">
            Noch keine Routine-Einträge.<br>Häufig getrackte Lebensmittel hier speichern.
          </div>` :
          routine.map((item, i) => `
            <div class="routine-item-row">
              <div style="flex:1;min-width:0">
                <div class="routine-item-name">${escHtml(item.name)}</div>
                <div class="routine-item-meta">
                  ${item.amount}g · ${Math.round((item.kcal_100g ?? 0) * item.amount / 100)} kcal
                  · ${mealLabel(item.meal_type)}
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" data-del-routine="${i}"
                style="padding:4px 8px;flex-shrink:0;color:var(--red)">✕</button>
            </div>`).join('')}
        <div style="padding:8px 12px 12px">
          <button class="btn btn-ghost btn-sm" id="btn-add-routine" style="width:100%">
            + Routine-Eintrag hinzufügen
          </button>
        </div>
      </div>
    </div>

    <!-- KI / API Key -->
    <div class="section" style="padding-top:0">
      <div class="section-label">KI-Rezepte (Claude API)</div>
      <div class="card">
        <div class="settings-row">
          <label class="settings-label" for="api-key-input">Anthropic API-Key</label>
          <input id="api-key-input" class="input" type="password"
            value="${settings.apiKey}" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
          <div class="settings-hint">
            Nur lokal gespeichert, nie übertragen.<br>
            Key besorgen: <strong>console.anthropic.com</strong> → API Keys → Create Key
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label">Kosten pro Rezept</div>
          <div style="font-size:14px;color:var(--text)">ca. <strong>$0.001 – $0.01</strong> (Haiku 4.5)</div>
        </div>
      </div>
    </div>

    <div class="section" style="padding-top:0">
      <button class="btn btn-primary" id="btn-save">Einstellungen speichern</button>
    </div>

    <!-- App Info -->
    <div class="section" style="padding-top:0">
      <div class="section-label">App-Info</div>
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="background:var(--accent-dim);color:var(--accent)">📱</div>
          <div class="card-body">
            <div class="card-title">KaloTrack</div>
            <div class="card-subtitle">Version 4.0 · PWA · Familienedition</div>
          </div>
        </div>
        <div class="card-row">
          <div class="card-icon" style="background:var(--green-dim);color:var(--green)">🥗</div>
          <div class="card-body">
            <div class="card-title">Open Food Facts</div>
            <div class="card-subtitle">Lebensmittel-Datenbank · openfoodfacts.org</div>
          </div>
        </div>
        <div class="card-row">
          <div class="card-icon" style="background:var(--orange-dim);color:var(--orange)">🤖</div>
          <div class="card-body">
            <div class="card-title">Claude AI (Anthropic)</div>
            <div class="card-subtitle">Rezeptgenerierung · anthropic.com</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Daten löschen -->
    <div class="section" style="padding-top:0">
      <div class="section-label">Daten</div>
      <div class="card">
        <div class="settings-row">
          <div class="settings-label">Alle Daten löschen</div>
          <button class="btn btn-danger btn-sm" id="btn-reset">Alle App-Daten löschen</button>
          <div class="settings-hint">Löscht Tagebuch, Rezepte und Einkaufslisten. API-Key bleibt erhalten.</div>
        </div>
      </div>
    </div>

    <!-- PWA Install -->
    <div id="install-banner" class="section" style="display:none;padding-top:0">
      <div class="card" style="padding:16px;background:var(--accent-dim);border-color:var(--accent)">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">📲 App installieren</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          KaloTrack als App auf dem Homescreen speichern.
        </div>
        <button class="btn btn-primary btn-sm" id="btn-install">Jetzt installieren</button>
      </div>
    </div>

    <!-- iOS Install Hint (immer sichtbar auf iOS) -->
    <div id="ios-install-hint" class="section" style="display:none;padding-top:0">
      <div class="card" style="padding:16px;background:var(--accent-dim);border-color:var(--accent)">
        <div style="font-size:15px;font-weight:700;margin-bottom:8px">📲 App auf dem Homescreen</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.7">
          1. Tippe unten auf das <strong>Teilen-Symbol</strong> (□↑)<br>
          2. Wähle <strong>„Zum Home-Bildschirm"</strong><br>
          3. Tippe oben rechts auf <strong>„Hinzufügen"</strong>
        </div>
      </div>
    </div>
  `;

  // Phase pills
  container.querySelectorAll('[data-phase]').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedPhase = pill.dataset.phase;
      container.querySelectorAll('[data-phase]').forEach(p =>
        p.classList.toggle('active', p.dataset.phase === selectedPhase));
      const p = PHASES.find(ph => ph.id === selectedPhase) ?? PHASES[0];
      container.querySelector('#phase-details').innerHTML = phaseDetails(p);
    });
  });

  const goalInput     = container.querySelector('#goal-input');
  const activityInput = container.querySelector('#activity-input');
  const totalDisplay  = container.querySelector('#total-display');
  const splitDisplay  = container.querySelector('#meal-split-display');

  const updateTotal = () => {
    const t = (parseInt(goalInput.value) || 0) + (parseInt(activityInput.value) || 0);
    totalDisplay.textContent = `${t} kcal`;
    splitDisplay.innerHTML   = mealSplitText(t);
  };
  goalInput.addEventListener('input', updateTotal);
  activityInput.addEventListener('input', updateTotal);

  // Save settings
  container.querySelector('#btn-save').addEventListener('click', async () => {
    const goal      = parseInt(goalInput.value);
    const activity  = parseInt(activityInput.value) || 0;
    const waterGoal = parseInt(container.querySelector('#water-goal-input').value) || 2500;
    if (!goal || goal < 100 || goal > 20000) { showToast('Ungültiges Kalorienziel'); return; }
    await saveSettings({
      ...settings,
      dailyGoal:    goal,
      activityKcal: activity,
      waterGoalMl:  waterGoal,
      apiKey:       container.querySelector('#api-key-input').value.trim(),
      phase:        selectedPhase,
    });
    showToast('Einstellungen gespeichert ✓');
    refresh();
  });

  // Profile edit
  container.querySelectorAll('[data-edit-profile]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid     = btn.dataset.editProfile;
      const profs   = await getProfiles();
      const profile = profs.find(p => p.id === pid);
      if (!profile) return;
      openProfileModal(profile, async updated => {
        await saveProfiles(profs.map(p => p.id === pid ? { ...p, ...updated } : p));
        showToast('Profil gespeichert ✓');
        renderSettings(container);
      });
    });
  });

  // Routine delete
  container.querySelectorAll('[data-del-routine]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx  = parseInt(btn.dataset.delRoutine);
      const s    = await getSettings();
      const newR = [...(s.routine ?? [])];
      newR.splice(idx, 1);
      await saveSettings({ ...s, routine: newR });
      showToast('Eintrag entfernt');
      renderSettings(container);
    });
  });

  // Routine add
  container.querySelector('#btn-add-routine')?.addEventListener('click', () => {
    openRoutineModal(async item => {
      const s = await getSettings();
      await saveSettings({ ...s, routine: [...(s.routine ?? []), { id: `r${Date.now()}`, ...item }] });
      showToast('Routine-Eintrag hinzugefügt ✓');
      renderSettings(container);
    });
  });

  // Reset data
  container.querySelector('#btn-reset')?.addEventListener('click', async () => {
    if (!confirm('Wirklich alle Daten löschen?')) return;
    const { clear } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');
    const s = await getSettings();
    await clear();
    await saveSettings({ dailyGoal: s.dailyGoal, apiKey: s.apiKey, activityKcal: 0, phase: s.phase ?? 'ausgewogen' });
    showToast('Daten gelöscht');
    refresh();
  });

  // iOS: kein beforeinstallprompt — manuellen Hinweis zeigen
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode = ('standalone' in navigator) && navigator.standalone;
  if (isIos && !isInStandaloneMode) {
    container.querySelector('#ios-install-hint').style.display = '';
  }

  // Android / Chrome: automatischer Install-Button
  if (window._deferredInstallPrompt) {
    container.querySelector('#install-banner').style.display = '';
    container.querySelector('#btn-install')?.addEventListener('click', async () => {
      window._deferredInstallPrompt.prompt();
      const { outcome } = await window._deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        window._deferredInstallPrompt = null;
        container.querySelector('#install-banner').style.display = 'none';
        showToast('App installiert!');
      }
    });
  }
}

// ── Profile Edit Modal ────────────────────────────────────
function openProfileModal(profile, onSave) {
  openModal(box => {
    box.innerHTML += `
      <div class="modal-title">Profil bearbeiten</div>
      <div style="padding:0 20px 20px">
        <div class="input-group">
          <label class="input-label">Name</label>
          <input id="prof-name" class="input" type="text" value="${escHtml(profile.name)}">
        </div>
        <div class="input-group">
          <label class="input-label">Emoji</label>
          <input id="prof-emoji" class="input" type="text" value="${escHtml(profile.emoji)}"
            maxlength="4" style="font-size:24px;text-align:center;letter-spacing:2px">
        </div>
        <div class="input-group">
          <label class="input-label">Farbe</label>
          <input id="prof-color" class="input" type="color" value="${escHtml(profile.color)}"
            style="height:44px;padding:4px 8px">
        </div>
        <button class="btn btn-primary" id="btn-prof-save" style="margin-top:4px">Speichern</button>
      </div>`;

    box.querySelector('#btn-prof-save').addEventListener('click', () => {
      const name  = box.querySelector('#prof-name').value.trim()  || profile.name;
      const emoji = box.querySelector('#prof-emoji').value.trim() || profile.emoji;
      const color = box.querySelector('#prof-color').value        || profile.color;
      closeModal();
      onSave({ name, emoji, color });
    });
  });
}

// ── Routine Add Modal ─────────────────────────────────────
function openRoutineModal(onSave) {
  openModal(box => {
    box.innerHTML += `
      <div class="modal-title">Routine-Eintrag hinzufügen</div>
      <div style="padding:0 20px 20px">
        <div class="input-group">
          <label class="input-label">Name</label>
          <input id="r-name" class="input" type="text" placeholder="z.B. Protein-Shake">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="input-group">
            <label class="input-label">Menge (g / ml)</label>
            <input id="r-amount" class="input" type="number" value="100" inputmode="numeric">
          </div>
          <div class="input-group">
            <label class="input-label">kcal / 100g</label>
            <input id="r-kcal" class="input" type="number" value="0" inputmode="numeric">
          </div>
          <div class="input-group">
            <label class="input-label">Protein / 100g</label>
            <input id="r-protein" class="input" type="number" value="0" inputmode="decimal">
          </div>
          <div class="input-group">
            <label class="input-label">Fett / 100g</label>
            <input id="r-fat" class="input" type="number" value="0" inputmode="decimal">
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Mahlzeit</label>
          <select id="r-meal" class="input">
            <option value="fruehstueck">Frühstück</option>
            <option value="mittagessen">Mittagessen</option>
            <option value="abendessen">Abendessen</option>
            <option value="snack">Snack</option>
            <option value="getraenke">Getränk</option>
          </select>
        </div>
        <button class="btn btn-primary" id="btn-r-save" style="margin-top:4px">Hinzufügen</button>
      </div>`;

    box.querySelector('#btn-r-save').addEventListener('click', () => {
      const name = box.querySelector('#r-name').value.trim();
      if (!name) { showToast('Bitte Name eingeben'); return; }
      const item = {
        name,
        amount:       parseInt(box.querySelector('#r-amount').value) || 100,
        kcal_100g:    parseFloat(box.querySelector('#r-kcal').value)    || 0,
        protein_100g: parseFloat(box.querySelector('#r-protein').value) || 0,
        carbs_100g:   0,
        fat_100g:     parseFloat(box.querySelector('#r-fat').value)     || 0,
        meal_type:    box.querySelector('#r-meal').value,
      };
      closeModal();
      onSave(item);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────
function phaseDetails(phase) {
  return `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:8px">${phase.desc}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span style="font-size:12px;padding:3px 8px;border-radius:99px;background:var(--orange-dim);color:var(--orange)">
        Protein ${phase.macros.protein}%
      </span>
      <span style="font-size:12px;padding:3px 8px;border-radius:99px;background:var(--accent-dim);color:var(--accent)">
        Kohlenhydrate ${phase.macros.carbs}%
      </span>
      <span style="font-size:12px;padding:3px 8px;border-radius:99px;background:var(--surface-3);color:var(--text-2)">
        Fett ${phase.macros.fat}%
      </span>
      <span style="font-size:12px;padding:3px 8px;border-radius:99px;background:var(--green-dim);color:var(--green)">
        ${phase.proteinPerKg}g Protein/kg Körpergewicht
      </span>
    </div>`;
}

function mealSplitText(total) {
  const fr = Math.round(total * 0.25);
  const mi = Math.round(total * 0.35);
  const ab = Math.round(total * 0.30);
  const sn = Math.round(total * 0.10);
  return `🌅 Frühstück ${fr} · ☀️ Mittag ${mi} · 🌙 Abend ${ab} · 🍎 Snacks ${sn} kcal`;
}

function mealLabel(key) {
  return { fruehstueck: 'Frühstück', mittagessen: 'Mittagessen', abendessen: 'Abendessen',
           snack: 'Snack', getraenke: 'Getränk' }[key] ?? key;
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._deferredInstallPrompt = e;
});

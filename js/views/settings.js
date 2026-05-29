import { getSettings, saveSettings, PHASES } from '../db.js';
import { showToast, refresh } from '../app.js';

let selectedPhase = 'ausgewogen';

export async function renderSettings(container) {
  const settings = await getSettings();
  selectedPhase  = settings.phase ?? 'ausgewogen';
  const total    = (settings.dailyGoal ?? 2000) + (settings.activityKcal ?? 0);
  const phase    = PHASES.find(p => p.id === selectedPhase) ?? PHASES[0];

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Einstellungen</h1>
        <div class="subtitle">App konfigurieren</div>
      </div>
    </header>

    <!-- Ernährungsphase -->
    <div class="section">
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
          <div class="settings-hint">Zusätzlich verbrannte Kalorien durch Sport heute. Erhöht dein Tagesbudget.</div>
        </div>
        <div class="settings-row" style="background:var(--accent-dim);border-radius:var(--radius-sm)">
          <div class="settings-label">Gesamtbudget heute</div>
          <div id="total-display" style="font-size:26px;font-weight:800;color:var(--accent)">${total} kcal</div>
          <div class="settings-hint" id="meal-split-display">${mealSplitText(total)}</div>
        </div>
      </div>
    </div>

    <!-- API Key -->
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
          <div style="font-size:14px;color:var(--text)">ca. <strong>$0.001 – $0.01</strong> (Haiku-Modell)</div>
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
            <div class="card-subtitle">Version 3.0 · PWA</div>
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
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">App installieren</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          KaloTrack als App auf dem Homescreen speichern.
        </div>
        <button class="btn btn-primary btn-sm" id="btn-install">📲 Jetzt installieren</button>
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

  container.querySelector('#btn-save').addEventListener('click', async () => {
    const goal     = parseInt(goalInput.value);
    const activity = parseInt(activityInput.value) || 0;
    if (!goal || goal < 100 || goal > 20000) { showToast('Ungültiges Kalorienziel'); return; }
    await saveSettings({
      ...settings,
      dailyGoal:   goal,
      activityKcal: activity,
      apiKey:      container.querySelector('#api-key-input').value.trim(),
      phase:       selectedPhase,
    });
    showToast('Einstellungen gespeichert ✓');
    refresh();
  });

  container.querySelector('#btn-reset')?.addEventListener('click', async () => {
    if (!confirm('Wirklich alle Daten löschen?')) return;
    const { clear } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');
    const s = await getSettings();
    await clear();
    await saveSettings({ dailyGoal: s.dailyGoal, apiKey: s.apiKey, activityKcal: 0, phase: s.phase ?? 'ausgewogen' });
    showToast('Daten gelöscht');
    refresh();
  });

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

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._deferredInstallPrompt = e;
});

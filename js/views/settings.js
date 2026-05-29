import { getSettings, saveSettings } from '../db.js';
import { showToast, refresh } from '../app.js';

export async function renderSettings(container) {
  const settings = await getSettings();

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Einstellungen</h1>
        <div class="subtitle">App konfigurieren</div>
      </div>
    </header>

    <div class="section">
      <div class="section-label">Ernährungsziel</div>
      <div class="card">
        <div class="settings-row">
          <label class="settings-label" for="goal-input">Tagesziel (kcal)</label>
          <input id="goal-input" class="input" type="number" min="500" max="10000"
            value="${settings.dailyGoal}" inputmode="numeric" placeholder="2000">
          <div class="settings-hint">Empfehlung: 1800–2500 kcal je nach Körpergröße und Aktivität.</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">KI-Rezepte (Claude API)</div>
      <div class="card">
        <div class="settings-row">
          <label class="settings-label" for="api-key-input">Anthropic API-Key</label>
          <input id="api-key-input" class="input" type="password"
            value="${settings.apiKey}"
            placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
          <div class="settings-hint">
            Dein Key wird nur lokal auf diesem Gerät gespeichert, nie übertragen.<br>
            Key besorgen: <strong>console.anthropic.com</strong> → API Keys → Create Key
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label">Kosten pro Rezept</div>
          <div style="font-size:14px;color:var(--text)">ca. <strong>$0.001 – $0.01</strong> (Haiku-Modell)</div>
          <div class="settings-hint">Günstigstes Claude-Modell. 1000 Rezepte ≈ $1–10.</div>
        </div>
      </div>
    </div>

    <div class="section">
      <button class="btn btn-primary" id="btn-save">Einstellungen speichern</button>
    </div>

    <div class="section">
      <div class="section-label">App-Info</div>
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="background:var(--accent-dim);color:var(--accent)">📱</div>
          <div class="card-body">
            <div class="card-title">KaloTrack</div>
            <div class="card-subtitle">Version 1.0 · PWA</div>
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

    <div class="section">
      <div class="section-label">Daten</div>
      <div class="card">
        <div class="settings-row">
          <div class="settings-label">Alle Daten löschen</div>
          <button class="btn btn-danger btn-sm" id="btn-reset">Alle App-Daten löschen</button>
          <div class="settings-hint">Löscht Tagebuch, Rezepte und Einkaufslisten. API-Key bleibt erhalten.</div>
        </div>
      </div>
    </div>

    <!-- PWA Install Banner -->
    <div id="install-banner" class="section" style="display:none">
      <div class="card" style="padding:16px;background:var(--accent-dim);border-color:var(--accent)">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">App installieren</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:12px">
          KaloTrack als App auf dem Homescreen speichern für schnelleren Zugriff.
        </div>
        <button class="btn btn-primary btn-sm" id="btn-install">📲 Jetzt installieren</button>
      </div>
    </div>
  `;

  const goalInput   = container.querySelector('#goal-input');
  const apiKeyInput = container.querySelector('#api-key-input');
  const btnSave     = container.querySelector('#btn-save');

  btnSave.addEventListener('click', async () => {
    const goal = parseInt(goalInput.value);
    if (!goal || goal < 100 || goal > 20000) {
      showToast('Ungültiges Kalorienziel');
      return;
    }
    await saveSettings({ dailyGoal: goal, apiKey: apiKeyInput.value.trim() });
    showToast('Einstellungen gespeichert ✓');
    refresh();
  });

  container.querySelector('#btn-reset')?.addEventListener('click', async () => {
    if (!confirm('Wirklich alle Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
    const { clear } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');
    const s = await getSettings();
    await clear();
    await saveSettings({ dailyGoal: s.dailyGoal, apiKey: s.apiKey });
    showToast('Daten gelöscht');
    refresh();
  });

  // PWA Install
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

// Capture beforeinstallprompt globally
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window._deferredInstallPrompt = e;
});

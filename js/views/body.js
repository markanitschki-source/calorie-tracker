import { getBodyData, saveBodyData, addWeightEntry, getWeightHistory, getSettings, saveSettings, PHASES } from '../db.js';
import { showToast } from '../app.js';

const ACTIVITY_LEVELS = [
  { value: 1.2,   label: 'Kaum aktiv',  desc: 'Kein Sport' },
  { value: 1.375, label: 'Leicht',       desc: '1–3×/Wo' },
  { value: 1.55,  label: 'Mäßig',        desc: '3–5×/Wo' },
  { value: 1.725, label: 'Sehr aktiv',   desc: '6–7×/Wo' },
  { value: 1.9,   label: 'Extrem',       desc: 'Tägl. intensiv' },
];

export async function renderBody(container) {
  await paint(container);
}

async function paint(container) {
  const [body, history, settings] = await Promise.all([
    getBodyData(), getWeightHistory(), getSettings(),
  ]);

  const phase       = PHASES.find(p => p.id === (settings.phase ?? 'ausgewogen')) ?? PHASES[0];
  const bmi         = body.weightKg && body.heightCm
    ? body.weightKg / ((body.heightCm / 100) ** 2) : null;
  const bmiInfo     = bmi ? getBmiInfo(bmi) : null;
  const proteinRec  = body.weightKg ? Math.round(body.weightKg * phase.proteinPerKg) : null;
  const recent      = history.slice(-30);
  const selActivity = body.activityLevel ?? 1.375;
  const selGender   = body.gender ?? 'male';
  const bmr         = (body.weightKg && body.heightCm && body.ageYears)
    ? calcBmr(body.weightKg, body.heightCm, body.ageYears, selGender) : null;
  const tdee        = bmr ? Math.round(bmr * selActivity) : null;

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Körper</h1>
        <div class="subtitle">Gewicht, BMI & Grundumsatz</div>
      </div>
    </header>

    <div class="section">
      <div class="section-label">Meine Körperdaten</div>
      <div class="card">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 14px 0">
          <div class="input-group" style="margin:0">
            <label class="input-label">Gewicht (kg)</label>
            <input id="weight-input" class="input" type="number" step="0.1" min="30" max="300"
              value="${body.weightKg ?? ''}" inputmode="decimal" placeholder="70.5">
          </div>
          <div class="input-group" style="margin:0">
            <label class="input-label">Größe (cm)</label>
            <input id="height-input" class="input" type="number" step="1" min="100" max="250"
              value="${body.heightCm ?? ''}" inputmode="numeric" placeholder="175">
          </div>
        </div>

        <div id="bmi-display" style="margin:14px 14px 0">
          ${bmiInfo ? bmiCard(bmi, bmiInfo) : `
          <div style="padding:12px;background:var(--surface-3);border-radius:var(--radius-sm);text-align:center;font-size:13px;color:var(--text-3)">
            Gewicht und Größe eingeben um BMI zu berechnen
          </div>`}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 14px 0">
          <div class="input-group" style="margin:0">
            <label class="input-label">Alter</label>
            <input id="age-input" class="input" type="number" step="1" min="10" max="120"
              value="${body.ageYears ?? ''}" inputmode="numeric" placeholder="30">
          </div>
          <div class="input-group" style="margin:0">
            <label class="input-label">Geschlecht</label>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="btn btn-ghost btn-sm gender-btn" data-gender="male"
                style="${selGender === 'male' ? 'background:var(--accent-dim);color:var(--accent);border-color:var(--accent)' : ''}">
                ♂ Mann
              </button>
              <button class="btn btn-ghost btn-sm gender-btn" data-gender="female"
                style="${selGender === 'female' ? 'background:var(--accent-dim);color:var(--accent);border-color:var(--accent)' : ''}">
                ♀ Frau
              </button>
            </div>
          </div>
        </div>

        <div style="padding:12px 14px 0">
          <div class="input-label">Aktivitätslevel</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
            ${ACTIVITY_LEVELS.map(a => `
              <button class="activity-btn" data-value="${a.value}"
                style="padding:5px 10px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid ${a.value == selActivity ? 'var(--accent)' : 'var(--border)'};background:${a.value == selActivity ? 'var(--accent-dim)' : 'var(--surface-2)'};color:${a.value == selActivity ? 'var(--accent)' : 'var(--text-2)'};cursor:pointer;line-height:1.5;text-align:center">
                ${a.label}<br><span style="font-size:10px;font-weight:400;opacity:0.7">${a.desc}</span>
              </button>`).join('')}
          </div>
        </div>

        <div id="tdee-display" style="margin:12px 14px 0">
          ${bmr && tdee ? tdeeCard(bmr, tdee, settings.dailyGoal) : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 14px 0">
          <div class="input-group" style="margin:0">
            <label class="input-label">Zielgewicht (kg)</label>
            <input id="target-input" class="input" type="number" step="0.1" min="30" max="300"
              value="${body.targetWeightKg ?? ''}" inputmode="decimal" placeholder="68">
          </div>
          <div></div>
        </div>

        <div style="padding:10px 14px 0">
          <div class="input-label" style="margin-bottom:6px">Körpermaße (cm)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div class="input-group" style="margin:0">
              <label class="input-label" style="font-size:11px">Taille</label>
              <input id="waist-input" class="input" type="number" step="0.1" min="40" max="250"
                value="${body.waistCm ?? ''}" inputmode="decimal" placeholder="80">
            </div>
            <div class="input-group" style="margin:0">
              <label class="input-label" style="font-size:11px">Hüfte</label>
              <input id="hip-input" class="input" type="number" step="0.1" min="40" max="250"
                value="${body.hipCm ?? ''}" inputmode="decimal" placeholder="95">
            </div>
            <div class="input-group" style="margin:0">
              <label class="input-label" style="font-size:11px">Brust</label>
              <input id="chest-input" class="input" type="number" step="0.1" min="40" max="250"
                value="${body.chestCm ?? ''}" inputmode="decimal" placeholder="100">
            </div>
          </div>
        </div>

        <div style="padding:12px 14px 14px">
          <button class="btn btn-primary" id="btn-save-body" style="width:100%">Speichern</button>
        </div>

      </div>
    </div>

    ${body.weightKg && proteinRec ? `
    <div class="section" style="padding-top:0">
      <div class="section-label">Proteinziel</div>
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="background:var(--orange-dim);color:var(--orange)">🥩</div>
          <div class="card-body">
            <div class="card-title"><strong>${proteinRec}g Protein</strong> pro Tag</div>
            <div class="card-subtitle">Phase: ${phase.label} · ${phase.proteinPerKg}g/kg × ${body.weightKg}kg</div>
          </div>
        </div>
        <div style="padding:8px 14px 14px">
          <div style="font-size:12px;color:var(--text-3);margin-bottom:8px">Andere Phasen im Vergleich:</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${PHASES.map(p => `
              <span style="font-size:11px;padding:3px 8px;border-radius:99px;background:${p.id === phase.id ? 'var(--accent)' : 'var(--surface-3)'};color:${p.id === phase.id ? '#fff' : 'var(--text-2)'}">
                ${p.label}: ${Math.round(body.weightKg * p.proteinPerKg)}g
              </span>`).join('')}
          </div>
        </div>
      </div>
    </div>` : ''}

    ${recent.length >= 2 ? `
    <div class="section" style="padding-top:0">
      <div class="section-label">Gewichtsverlauf (letzte ${recent.length} Einträge)</div>
      <div class="card" style="padding:16px">
        ${buildWeightChart(recent, body.targetWeightKg)}
      </div>
    </div>` : recent.length === 1 ? `
    <div class="section" style="padding-top:0">
      <div class="card" style="padding:16px;text-align:center;color:var(--text-3);font-size:13px">
        Noch 1 Eintrag — speichere morgen erneut für den Verlauf
      </div>
    </div>` : ''}

    ${history.length > 0 ? `
    <div class="section" style="padding-top:0">
      <div class="section-label">Letzte Einträge</div>
      <div class="card">
        ${history.slice(-10).reverse().map(e => {
          const diff = body.targetWeightKg ? (e.weightKg - body.targetWeightKg).toFixed(1) : null;
          return `
          <div class="card-row">
            <div class="card-body">
              <div class="card-title">${e.weightKg} kg</div>
              <div class="card-subtitle">${formatDate(e.date)}</div>
            </div>
            ${diff !== null ? `
            <div class="card-right">
              <div class="card-kcal" style="color:${parseFloat(diff) <= 0 ? 'var(--green)' : 'var(--text-2)'}">
                ${parseFloat(diff) <= 0 ? '✓ Ziel' : '+' + diff + 'kg'}
              </div>
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  let currentActivity = selActivity;
  let currentGender   = selGender;
  let currentGoal     = settings.dailyGoal;

  const wInput = container.querySelector('#weight-input');
  const hInput = container.querySelector('#height-input');
  const aInput = container.querySelector('#age-input');

  const attachTdeeBtn = () => {
    const btn = container.querySelector('#btn-use-tdee');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const tdeeVal = parseInt(btn.dataset.tdee);
      const s = await getSettings();
      await saveSettings({ ...s, dailyGoal: tdeeVal });
      currentGoal = tdeeVal;
      showToast(`Kalorienziel auf ${tdeeVal} kcal gesetzt ✓`);
      const w = parseFloat(wInput.value);
      const h = parseInt(hInput.value);
      const a = parseInt(aInput.value);
      if (w > 0 && h > 0 && a > 0) {
        const bmrVal = calcBmr(w, h, a, currentGender);
        container.querySelector('#tdee-display').innerHTML =
          tdeeCard(bmrVal, tdeeVal, tdeeVal);
        attachTdeeBtn();
      }
    });
  };

  const updateMetrics = () => {
    const w = parseFloat(wInput.value);
    const h = parseInt(hInput.value);
    const a = parseInt(aInput.value);

    if (w > 0 && h > 0) {
      const bmiVal = w / ((h / 100) ** 2);
      container.querySelector('#bmi-display').innerHTML = bmiCard(bmiVal, getBmiInfo(bmiVal));
    }

    const tdeeDisplay = container.querySelector('#tdee-display');
    if (w > 0 && h > 0 && a > 0) {
      const bmrVal  = calcBmr(w, h, a, currentGender);
      const tdeeVal = Math.round(bmrVal * currentActivity);
      tdeeDisplay.innerHTML = tdeeCard(bmrVal, tdeeVal, currentGoal);
      attachTdeeBtn();
    } else {
      tdeeDisplay.innerHTML = '';
    }
  };

  wInput?.addEventListener('input', updateMetrics);
  hInput?.addEventListener('input', updateMetrics);
  aInput?.addEventListener('input', updateMetrics);

  container.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentGender = btn.dataset.gender;
      container.querySelectorAll('.gender-btn').forEach(b => {
        const active = b.dataset.gender === currentGender;
        b.style.background  = active ? 'var(--accent-dim)' : '';
        b.style.color        = active ? 'var(--accent)'     : '';
        b.style.borderColor  = active ? 'var(--accent)'     : '';
      });
      updateMetrics();
    });
  });

  container.querySelectorAll('.activity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentActivity = parseFloat(btn.dataset.value);
      container.querySelectorAll('.activity-btn').forEach(b => {
        const active = parseFloat(b.dataset.value) === currentActivity;
        b.style.background  = active ? 'var(--accent-dim)' : 'var(--surface-2)';
        b.style.color        = active ? 'var(--accent)'     : 'var(--text-2)';
        b.style.borderColor  = active ? 'var(--accent)'     : 'var(--border)';
      });
      updateMetrics();
    });
  });

  attachTdeeBtn();

  container.querySelector('#btn-save-body').addEventListener('click', async () => {
    const weightKg       = parseFloat(wInput.value) || null;
    const heightCm       = parseInt(hInput.value) || null;
    const ageYears       = parseInt(aInput.value) || null;
    const targetWeightKg = parseFloat(container.querySelector('#target-input').value) || null;
    const waistCm        = parseFloat(container.querySelector('#waist-input').value) || null;
    const hipCm          = parseFloat(container.querySelector('#hip-input').value) || null;
    const chestCm        = parseFloat(container.querySelector('#chest-input').value) || null;

    await saveBodyData({ weightKg, heightCm, ageYears, targetWeightKg, gender: currentGender, activityLevel: currentActivity, waistCm, hipCm, chestCm });
    if (weightKg) {
      await addWeightEntry(weightKg);
      const history = await getWeightHistory();
      const { onWeightAdded } = await import('../achievements.js');
      const r = await onWeightAdded(weightKg, history);
      if (r.leveledUp)            showToast(`🎉 Level ${r.levelInfo.current.level} — ${r.levelInfo.current.label}!`);
      else if (r.unlocked?.length) showToast(`🏆 ${r.unlocked[0].icon} ${r.unlocked[0].label} freigeschaltet!`);
      else                         showToast(`Gespeichert ✓ +${r.xpEarned} XP`);
    } else {
      showToast('Gespeichert ✓');
    }
    await paint(container);
  });
}

function tdeeCard(bmr, tdee, currentGoal) {
  const isSet = currentGoal === tdee;
  return `
    <div style="padding:14px;background:var(--surface-3);border-radius:var(--radius-sm)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;color:var(--text-2)">Grundumsatz (BMR)</div>
        <div style="font-size:15px;font-weight:700">${bmr} kcal</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;color:var(--text-2)">Gesamtbedarf (TDEE)</div>
        <div style="font-size:20px;font-weight:800;color:var(--accent)">${tdee} kcal</div>
      </div>
      <button id="btn-use-tdee" data-tdee="${tdee}"
        class="btn ${isSet ? 'btn-success' : 'btn-primary'}" style="width:100%;font-size:13px">
        ${isSet ? '✓ Aktiv als Kalorienziel' : 'Als Kalorienziel übernehmen'}
      </button>
    </div>`;
}

function bmiCard(bmi, info) {
  return `
    <div style="padding:14px;background:${info.bg};border-radius:var(--radius-sm);text-align:center">
      <div style="font-size:40px;font-weight:900;color:${info.color};line-height:1">${bmi.toFixed(1)}</div>
      <div style="font-size:15px;font-weight:700;color:${info.color};margin-top:4px">${info.label}</div>
      <div style="font-size:12px;color:var(--text-2);margin-top:6px">${info.hint}</div>
    </div>`;
}

function getBmiInfo(bmi) {
  if (bmi < 18.5) return { label: 'Untergewicht', color: 'var(--accent)', bg: 'var(--accent-dim)', hint: 'BMI unter 18,5 · Ärztliche Beratung empfohlen' };
  if (bmi < 25)   return { label: 'Normalgewicht', color: 'var(--green)',  bg: 'var(--green-dim)',  hint: 'BMI 18,5 – 24,9 · Gesunder Bereich' };
  if (bmi < 30)   return { label: 'Übergewicht',   color: 'var(--orange)', bg: 'var(--orange-dim)', hint: 'BMI 25,0 – 29,9 · Leicht erhöhtes Risiko' };
  return             { label: 'Adipositas',     color: 'var(--red)',    bg: 'var(--red-dim)',    hint: 'BMI ≥ 30 · Erhöhtes Gesundheitsrisiko' };
}

function calcBmr(weightKg, heightCm, ageYears, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(gender === 'female' ? base - 161 : base + 5);
}

function formatDate(dateStr) {
  const d      = new Date(dateStr + 'T12:00:00');
  const days   = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}

function buildWeightChart(history, targetWeight) {
  const W = 320, H = 150;
  const PL = 38, PR = 14, PT = 12, PB = 28;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const weights = history.map(e => e.weightKg);
  const allW    = targetWeight ? [...weights, targetWeight] : weights;
  const minW    = Math.min(...allW) - 0.5;
  const maxW    = Math.max(...allW) + 0.5;
  const range   = maxW - minW || 1;

  const toX = i => PL + (i / (history.length - 1)) * cW;
  const toY = w => PT + cH - ((w - minW) / range * cH);

  const pts      = history.map((e, i) => `${toX(i).toFixed(1)},${toY(e.weightKg).toFixed(1)}`);
  const linePath = `M${pts.join(' L')}`;
  const last     = history.length - 1;
  const areaPath = `M${toX(0).toFixed(1)},${(H - PB).toFixed(1)} L${pts.join(' L')} L${toX(last).toFixed(1)},${(H - PB).toFixed(1)} Z`;

  const yLines = [];
  for (let i = 0; i <= 3; i++) {
    const w = minW + (range / 3 * i);
    const y = toY(w);
    yLines.push(`
      <line class="chart-grid" x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}"/>
      <text class="chart-text" x="${PL - 4}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle">${w.toFixed(1)}</text>`);
  }

  const xIdx    = history.length <= 3
    ? history.map((_, i) => i)
    : [0, Math.floor((history.length - 1) / 2), history.length - 1];
  const xLabels = xIdx.map(i => {
    const d   = new Date(history[i].date + 'T12:00:00');
    return `<text class="chart-text" x="${toX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${d.getDate()}.${d.getMonth() + 1}.</text>`;
  });

  const targetLine = targetWeight != null && targetWeight > 0 ? `
    <line class="target-line" x1="${PL}" y1="${toY(targetWeight).toFixed(1)}" x2="${W - PR}" y2="${toY(targetWeight).toFixed(1)}"/>
    <text class="chart-text" x="${W - PR}" y="${(toY(targetWeight) - 5).toFixed(1)}" text-anchor="end" style="fill:var(--green)">Ziel ${targetWeight.toFixed(1)}</text>
  ` : '';

  const dots = history.map((e, i) =>
    `<circle class="chart-dot" cx="${toX(i).toFixed(1)}" cy="${toY(e.weightKg).toFixed(1)}" r="3.5"/>`
  ).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;overflow:visible">
      <style>
        .chart-line { stroke: var(--accent); fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
        .chart-area { fill: var(--accent); opacity: 0.08; }
        .chart-dot  { fill: var(--accent); stroke: var(--surface-2); stroke-width: 2; }
        .chart-grid { stroke: var(--surface-3); stroke-width: 1; fill: none; opacity: 0.6; }
        .chart-text { fill: var(--text-3); font-size: 9px; font-family: inherit; }
        .target-line{ stroke: var(--green); stroke-width: 1.5; stroke-dasharray: 4,3; opacity: 0.8; fill: none; }
      </style>
      ${yLines.join('')}
      ${xLabels.join('')}
      ${targetLine}
      <path class="chart-area" d="${areaPath}"/>
      <path class="chart-line" d="${linePath}"/>
      ${dots}
    </svg>`;
}

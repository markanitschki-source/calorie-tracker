import { getAchData } from '../db.js';
import { ACHIEVEMENTS, getLevelInfo } from '../achievements.js';

const CATS = ['Streak', 'Ziel', 'Protein', 'Wasser', 'Fasten', 'Körper', 'Rezepte', 'Tracking'];

export async function renderAchievements(container) {
  const d    = await getAchData();
  const info = getLevelInfo(d.xp);

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Achievements</h1>
        <div class="subtitle">${d.unlocked.length}/${ACHIEVEMENTS.length} freigeschaltet</div>
      </div>
    </header>

    <!-- Level Card -->
    <div class="section">
      <div class="card" style="padding:16px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;flex-shrink:0">
            ${info.current.level}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:19px;font-weight:800">${info.current.label}</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px">
              ${d.xp} XP${info.next ? ` · noch ${info.xpToNext} XP bis Lv.${info.next.level}` : ' · Max-Level!'}
            </div>
          </div>
        </div>
        <div style="height:8px;background:var(--surface-3);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${info.progress}%;background:var(--accent);border-radius:99px;transition:width 0.6s ease"></div>
        </div>
        ${info.next ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-3);margin-top:3px">
          <span>${info.current.minXP} XP</span><span>${info.next.minXP} XP</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="section" style="padding-top:0">
      <div class="section-label">Statistiken</div>
      <div class="macro-row">
        <div class="macro-card"><div class="m-value">${d.stats.totalMeals ?? 0}</div><div class="m-label">Mahlzeiten</div></div>
        <div class="macro-card"><div class="m-value">${d.stats.daysInGoal ?? 0}</div><div class="m-label">Tage im Ziel</div></div>
        <div class="macro-card"><div class="m-value">${d.stats.proteinDaysHit ?? 0}</div><div class="m-label">Protein-Tage</div></div>
      </div>
      <div class="macro-row" style="margin-top:8px">
        <div class="macro-card"><div class="m-value">${d.stats.waterDaysHit ?? 0}</div><div class="m-label">Wasser-Tage</div></div>
        <div class="macro-card"><div class="m-value">${d.stats.fastingCompleted ?? 0}</div><div class="m-label">Fastentage</div></div>
        <div class="macro-card"><div class="m-value">${d.stats.recipesGenerated ?? 0}</div><div class="m-label">Rezepte</div></div>
      </div>
    </div>

    <!-- Achievements by category -->
    ${CATS.map(cat => {
      const items = ACHIEVEMENTS.filter(a => a.cat === cat);
      if (!items.length) return '';
      return `
      <div class="section" style="padding-top:0">
        <div class="section-label">${cat}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 20px 4px">
          ${items.map(a => {
            const done = d.unlocked.includes(a.id);
            return `<div title="${a.desc}" style="background:var(--surface-2);border-radius:var(--radius-sm);padding:12px 6px;text-align:center;border:1px solid ${done ? 'var(--accent)' : 'transparent'};opacity:${done ? '1' : '0.4'}">
              <div style="font-size:26px;margin-bottom:5px">${a.icon}</div>
              <div style="font-size:11px;font-weight:700;color:${done ? 'var(--accent)' : 'var(--text-2)'};line-height:1.2">${a.label}</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:3px">${done ? '✓ ' : ''}+${a.xp} XP</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
}

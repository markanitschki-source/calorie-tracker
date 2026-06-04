import { getAchData, saveAchData } from './db.js';

export const LEVELS = [
  { level: 1,  label: 'Anfänger',       minXP: 0     },
  { level: 2,  label: 'Einsteiger',      minXP: 200   },
  { level: 3,  label: 'Tracker',         minXP: 500   },
  { level: 4,  label: 'Durchhalter',     minXP: 1000  },
  { level: 5,  label: 'Profi',           minXP: 2000  },
  { level: 6,  label: 'Experte',         minXP: 3500  },
  { level: 7,  label: 'Meister',         minXP: 5500  },
  { level: 8,  label: 'Champion',        minXP: 8000  },
  { level: 9,  label: 'Elite',           minXP: 11000 },
  { level: 10, label: 'Ernährungsprofi', minXP: 15000 },
];

export const XP = {
  MEAL:       10,
  GOAL_HIT:   50,
  PROTEIN_HIT: 30,
  WATER_HIT:  20,
  STREAK_DAY: 30,
  FASTING:    75,
  RECIPE:     15,
  WEIGHT:     25,
};

export const ACHIEVEMENTS = [
  { id: 'streak_3',     icon: '🔥', label: 'Erster Schritt',   desc: '3 Tage Streak',                   cat: 'Streak',   xp: 50   },
  { id: 'streak_7',     icon: '🔥', label: 'Wochenheld',       desc: '7 Tage Streak',                   cat: 'Streak',   xp: 100  },
  { id: 'streak_14',    icon: '🔥', label: 'Zwei Wochen',      desc: '14 Tage Streak',                  cat: 'Streak',   xp: 200  },
  { id: 'streak_30',    icon: '🔥', label: 'Monatsprofi',      desc: '30 Tage Streak',                  cat: 'Streak',   xp: 400  },
  { id: 'streak_100',   icon: '🔥', label: 'Legende',          desc: '100 Tage Streak',                 cat: 'Streak',   xp: 1000 },
  { id: 'goal_1',       icon: '🎯', label: 'Ins Schwarze',     desc: '1 Tag im Kalorienziel',           cat: 'Ziel',     xp: 50   },
  { id: 'goal_3',       icon: '🎯', label: 'Drei in Folge',    desc: '3 Tage in Folge im Ziel',         cat: 'Ziel',     xp: 100  },
  { id: 'goal_7',       icon: '🎯', label: 'Perfekte Woche',   desc: '7 Tage in Folge im Ziel',         cat: 'Ziel',     xp: 300  },
  { id: 'protein_1',    icon: '💪', label: 'Protein-Hit',      desc: 'Proteinziel 1× erreicht',         cat: 'Protein',  xp: 30   },
  { id: 'protein_7',    icon: '💪', label: 'Protein-Woche',    desc: 'Proteinziel 7× erreicht',         cat: 'Protein',  xp: 100  },
  { id: 'protein_30',   icon: '💪', label: 'Protein-Profi',    desc: 'Proteinziel 30× erreicht',        cat: 'Protein',  xp: 400  },
  { id: 'water_1',      icon: '💧', label: 'Gut hydriert',     desc: 'Wasserziel 1× erreicht',          cat: 'Wasser',   xp: 30   },
  { id: 'water_7',      icon: '💧', label: 'Wasser-Woche',     desc: 'Wasserziel 7× erreicht',          cat: 'Wasser',   xp: 100  },
  { id: 'water_30',     icon: '💧', label: 'Hydrations-Held',  desc: 'Wasserziel 30× erreicht',         cat: 'Wasser',   xp: 400  },
  { id: 'fast_1',       icon: '⏱', label: 'Erstes Fasten',    desc: 'Fastenperiode 1× abgeschlossen',  cat: 'Fasten',   xp: 75   },
  { id: 'fast_7',       icon: '⏱', label: 'Fasten-Veteran',   desc: 'Fastenperiode 7× abgeschlossen',  cat: 'Fasten',   xp: 250  },
  { id: 'weight_entry', icon: '⚖️', label: 'Waage gestiegen', desc: 'Erstes Gewicht eingetragen',      cat: 'Körper',   xp: 25   },
  { id: 'weight_1kg',   icon: '⚖️', label: 'Erster Kilo',     desc: '1 kg abgenommen',                 cat: 'Körper',   xp: 150  },
  { id: 'weight_5kg',   icon: '⚖️', label: 'Fünf Kilo',       desc: '5 kg abgenommen',                 cat: 'Körper',   xp: 500  },
  { id: 'recipe_1',     icon: '🍳', label: 'Erstes Rezept',    desc: 'Rezept generiert',                cat: 'Rezepte',  xp: 30   },
  { id: 'recipe_10',    icon: '🍳', label: 'Rezept-Koch',      desc: '10 Rezepte generiert',            cat: 'Rezepte',  xp: 150  },
  { id: 'meals_50',     icon: '🍽️', label: '50 Mahlzeiten',   desc: '50 Mahlzeiten getrackt',          cat: 'Tracking', xp: 100  },
  { id: 'meals_100',    icon: '🍽️', label: '100 Mahlzeiten',  desc: '100 Mahlzeiten getrackt',         cat: 'Tracking', xp: 200  },
  { id: 'meals_500',    icon: '🍽️', label: '500 Mahlzeiten',  desc: '500 Mahlzeiten getrackt',         cat: 'Tracking', xp: 500  },
];

export function getLevelInfo(xp) {
  let cur = LEVELS[0], next = LEVELS[1] ?? null;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) { cur = LEVELS[i]; next = LEVELS[i + 1] ?? null; break; }
  }
  const progress = next ? Math.round((xp - cur.minXP) / (next.minXP - cur.minXP) * 100) : 100;
  return { current: cur, next, progress, xpToNext: next ? next.minXP - xp : 0 };
}

function _tryUnlock(d, id) {
  if (d.unlocked.includes(id)) return null;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return null;
  d.unlocked.push(id);
  d.xp += a.xp;
  return a;
}

function _leveledUp(xpBefore, xpAfter) {
  return getLevelInfo(xpAfter).current.level > getLevelInfo(xpBefore).current.level;
}

export async function onMealAdded() {
  const d = await getAchData();
  const before = d.xp;
  d.stats.totalMeals = (d.stats.totalMeals ?? 0) + 1;
  d.xp += XP.MEAL;
  const unlocked = [];
  for (const t of [50, 100, 500]) {
    if (d.stats.totalMeals >= t) { const a = _tryUnlock(d, `meals_${t}`); if (a) unlocked.push(a); }
  }
  const leveledUp = _leveledUp(before, d.xp);
  await saveAchData(d);
  return { xpEarned: XP.MEAL, unlocked, leveledUp, levelInfo: getLevelInfo(d.xp) };
}

export async function onRecipeGenerated() {
  const d = await getAchData();
  const before = d.xp;
  d.stats.recipesGenerated = (d.stats.recipesGenerated ?? 0) + 1;
  d.xp += XP.RECIPE;
  const unlocked = [];
  for (const [t, id] of [[1, 'recipe_1'], [10, 'recipe_10']]) {
    if (d.stats.recipesGenerated >= t) { const a = _tryUnlock(d, id); if (a) unlocked.push(a); }
  }
  const leveledUp = _leveledUp(before, d.xp);
  await saveAchData(d);
  return { xpEarned: XP.RECIPE, unlocked, leveledUp, levelInfo: getLevelInfo(d.xp) };
}

export async function onWeightAdded(currentKg, history) {
  const d = await getAchData();
  const before = d.xp;
  d.xp += XP.WEIGHT;
  const unlocked = [];
  const a0 = _tryUnlock(d, 'weight_entry'); if (a0) unlocked.push(a0);
  if (history.length >= 2) {
    const lost = history[0].weightKg - currentKg;
    if (lost >= 1) { const a = _tryUnlock(d, 'weight_1kg'); if (a) unlocked.push(a); }
    if (lost >= 5) { const a = _tryUnlock(d, 'weight_5kg'); if (a) unlocked.push(a); }
  }
  const leveledUp = _leveledUp(before, d.xp);
  await saveAchData(d);
  return { xpEarned: XP.WEIGHT, unlocked, leveledUp, levelInfo: getLevelInfo(d.xp) };
}

export async function onFastingCompleted() {
  const d = await getAchData();
  const before = d.xp;
  d.stats.fastingCompleted = (d.stats.fastingCompleted ?? 0) + 1;
  d.xp += XP.FASTING;
  const unlocked = [];
  for (const [t, id] of [[1, 'fast_1'], [7, 'fast_7']]) {
    if (d.stats.fastingCompleted >= t) { const a = _tryUnlock(d, id); if (a) unlocked.push(a); }
  }
  const leveledUp = _leveledUp(before, d.xp);
  await saveAchData(d);
  return { xpEarned: XP.FASTING, unlocked, leveledUp, levelInfo: getLevelInfo(d.xp) };
}

export async function onWaterGoalHit(dateStr) {
  const d = await getAchData();
  if (d.stats.lastWaterGoalDate === dateStr) return { xpEarned: 0, unlocked: [], leveledUp: false };
  const before = d.xp;
  d.stats.waterDaysHit     = (d.stats.waterDaysHit     ?? 0) + 1;
  d.stats.lastWaterGoalDate = dateStr;
  d.xp += XP.WATER_HIT;
  const unlocked = [];
  for (const [t, id] of [[1, 'water_1'], [7, 'water_7'], [30, 'water_30']]) {
    if (d.stats.waterDaysHit >= t) { const a = _tryUnlock(d, id); if (a) unlocked.push(a); }
  }
  const leveledUp = _leveledUp(before, d.xp);
  await saveAchData(d);
  return { xpEarned: XP.WATER_HIT, unlocked, leveledUp, levelInfo: getLevelInfo(d.xp) };
}

export async function checkDailyAwards({ yesterdayDate, yesterdaySum, settings, phase, streak }) {
  const d = await getAchData();
  if (d.stats.lastCheckedDate === yesterdayDate) return { xpEarned: 0, unlocked: [], achData: d };
  if (!yesterdaySum || yesterdaySum.kcal < 50) {
    d.stats.daysInGoalStreak = 0;
    d.stats.lastCheckedDate  = yesterdayDate;
    await saveAchData(d);
    return { xpEarned: 0, unlocked: [], achData: d };
  }

  const before   = d.xp;
  const unlocked = [];
  let xpEarned   = 0;

  if (streak > 0) { d.xp += XP.STREAK_DAY; xpEarned += XP.STREAK_DAY; }

  const effectiveGoal = (settings.dailyGoal ?? 2000) + (settings.defizit ?? phase?.offset ?? 0);
  const goalHit = yesterdaySum.kcal <= effectiveGoal + 100;
  if (goalHit) {
    d.stats.daysInGoal       = (d.stats.daysInGoal       ?? 0) + 1;
    d.stats.daysInGoalStreak = (d.stats.daysInGoalStreak ?? 0) + 1;
    d.xp += XP.GOAL_HIT; xpEarned += XP.GOAL_HIT;
    for (const [t, id] of [[1, 'goal_1'], [3, 'goal_3'], [7, 'goal_7']]) {
      if (d.stats.daysInGoalStreak >= t) { const a = _tryUnlock(d, id); if (a) { unlocked.push(a); xpEarned += a.xp; } }
    }
  } else {
    d.stats.daysInGoalStreak = 0;
  }

  const proteinGoal = settings.proteinGoalG
    ?? Math.round(effectiveGoal * (phase?.macros?.protein ?? 25) / 100 / 4);
  if (yesterdaySum.protein >= proteinGoal * 0.9) {
    d.stats.proteinDaysHit = (d.stats.proteinDaysHit ?? 0) + 1;
    d.xp += XP.PROTEIN_HIT; xpEarned += XP.PROTEIN_HIT;
    for (const [t, id] of [[1, 'protein_1'], [7, 'protein_7'], [30, 'protein_30']]) {
      if (d.stats.proteinDaysHit >= t) { const a = _tryUnlock(d, id); if (a) { unlocked.push(a); xpEarned += a.xp; } }
    }
  }

  for (const [t, id] of [[3, 'streak_3'], [7, 'streak_7'], [14, 'streak_14'], [30, 'streak_30'], [100, 'streak_100']]) {
    if (streak >= t) { const a = _tryUnlock(d, id); if (a) { unlocked.push(a); xpEarned += a.xp; } }
  }

  d.stats.lastCheckedDate = yesterdayDate;
  const leveledUp = _leveledUp(before, d.xp);
  await saveAchData(d);
  return { xpEarned, unlocked, leveledUp, achData: d };
}

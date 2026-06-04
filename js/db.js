import { get, set, del, keys } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

const today = () => new Date().toISOString().split('T')[0];

// ── Profile State ─────────────────────────────────────────
let _pid = localStorage.getItem('kt_pid') ?? 'felix';

export const getActiveProfileId = () => _pid;

export async function switchProfile(id) {
  _pid = id;
  localStorage.setItem('kt_pid', id);
}

// profile-specific key
const pk = k => `${k}__${_pid}`;

// ── DB Init & Migration (one-time) ────────────────────────
export async function initDB() {
  if (await get('_kt_v3')) return;

  // Migrate old unprefixed keys → felix profile
  const legacyKeys = ['settings', 'body_data', 'weight_history', 'food_history',
                      'saved_meals', 'disliked_ingredients'];
  for (const k of legacyKeys) {
    const val = await get(k);
    if (val !== undefined) { await set(`${k}__felix`, val); await del(k); }
  }
  // Migrate log keys: log_YYYY-MM-DD → log_YYYY-MM-DD__felix
  const allKeys = await keys();
  for (const k of allKeys) {
    if (/^log_\d{4}-\d{2}-\d{2}$/.test(k)) {
      const val = await get(k);
      if (val !== undefined) { await set(`${k}__felix`, val); await del(k); }
    }
  }

  // Create default profiles (family)
  if (!(await get('profiles'))) {
    await set('profiles', [
      { id: 'felix', name: 'Felix',  emoji: '👨', color: '#6C63FF' },
      { id: 'hanna', name: 'Hanna',  emoji: '👩', color: '#FF6584' },
      { id: 'malea', name: 'Malea',  emoji: '👧', color: '#4ade80' },
      { id: 'koa',   name: 'Koa',    emoji: '👦', color: '#fb923c' },
    ]);
  }

  // Seed Felix's default routine (More protein shakes)
  const felixSettings = await get('settings__felix');
  if (!felixSettings?.routine?.length) {
    await set('settings__felix', {
      ...(felixSettings ?? {}),
      routine: [
        { id: 'r1', name: 'More Whey Protein Shake', brand: 'More Nutrition',
          kcal_100g: 387, protein_100g: 73, carbs_100g: 5.6, fat_100g: 6.3,
          amount: 35, meal_type: 'fruehstueck' },
        { id: 'r2', name: 'More Clear Protein Shake', brand: 'More Nutrition',
          kcal_100g: 350, protein_100g: 80, carbs_100g: 1.2, fat_100g: 0.5,
          amount: 30, meal_type: 'mittagessen' },
      ],
    });
  }

  await set('_kt_v3', true);
}

// ── DB Migration v4 (one-time) ────────────────────────────
export async function migrateV4() {
  if (await get('_kt_v4')) return;
  const profiles = await get('profiles');
  if (Array.isArray(profiles) && profiles.length > 1) {
    await set('profiles', profiles.filter(p => p.id === 'felix'));
  }
  await set('_kt_v4', true);
}

// ── Profiles ──────────────────────────────────────────────
export async function getProfiles() {
  return (await get('profiles')) ?? [];
}
export async function saveProfiles(profiles) {
  await set('profiles', profiles);
}

// ── Nutrition Phases ──────────────────────────────────────
export const PHASES = [
  { id: 'ausgewogen',      label: 'Ausgewogen',       desc: 'Ausgewogene Ernährung · Gesundheit & Wohlbefinden',    macros: { protein: 25, carbs: 50, fat: 25 }, offset:    0, proteinPerKg: 1.6 },
  { id: 'abnehmen',        label: 'Abnehmen',          desc: 'Moderates Defizit · Proteinreich für Muskelerhalt',   macros: { protein: 35, carbs: 40, fat: 25 }, offset: -300, proteinPerKg: 2.0 },
  { id: 'schnell-abnehmen',label: 'Schnell abnehmen',  desc: 'Deutliches Defizit · Sehr proteinreich',              macros: { protein: 40, carbs: 30, fat: 30 }, offset: -500, proteinPerKg: 2.2 },
  { id: 'muskelaufbau',    label: 'Muskelaufbau',      desc: 'Leichter Überschuss · Maximale Proteinzufuhr',        macros: { protein: 35, carbs: 45, fat: 20 }, offset:  200, proteinPerKg: 2.4 },
  { id: 'low-carb',        label: 'Low-Carb',          desc: 'Wenig Kohlenhydrate · Mehr Fett & Protein',           macros: { protein: 30, carbs: 20, fat: 50 }, offset:    0, proteinPerKg: 1.8 },
  { id: 'keto',            label: 'Keto',              desc: 'Minimal Kohlenhydrate · Hoher Fettanteil',            macros: { protein: 25, carbs:  5, fat: 70 }, offset:    0, proteinPerKg: 1.8 },
];

// ── Settings ──────────────────────────────────────────────
export async function getSettings() {
  const defaults = { dailyGoal: 2000, apiKey: '', activityKcal: 0, phase: 'ausgewogen', waterGoalMl: 2500, routine: [], defizit: null, proteinGoalG: null, fastingType: null };
  const saved    = await get(pk('settings'));
  return { ...defaults, ...saved };
}
export async function saveSettings(s) {
  await set(pk('settings'), s);
}

// ── Fasting ───────────────────────────────────────────────
export async function getFastingState() {
  return (await get(pk('fasting'))) ?? { active: false, startTime: null, type: null };
}
export async function saveFastingState(state) {
  await set(pk('fasting'), state);
}

// ── Water Tracking ────────────────────────────────────────
export async function getWaterToday() {
  return (await get(`water_${today()}__${_pid}`)) ?? 0;
}
export async function addWater(ml) {
  const cur  = await getWaterToday();
  const next = Math.max(0, cur + ml);
  await set(`water_${today()}__${_pid}`, next);
  return next;
}
export async function setWaterToday(ml) {
  const val = Math.max(0, ml);
  await set(`water_${today()}__${_pid}`, val);
  return val;
}

// ── Daily Food Log ────────────────────────────────────────
export async function getTodayLog() {
  const date = today();
  return (await get(`log_${date}__${_pid}`)) ?? { date, entries: [] };
}
export async function getLogForDate(date) {
  return (await get(`log_${date}__${_pid}`)) ?? { date, entries: [] };
}
export async function addFoodEntry(entry) {
  const log = await getTodayLog();
  log.entries.push({ ...entry, id: Date.now() });
  await set(`log_${log.date}__${_pid}`, log);
  return log;
}
export async function removeFoodEntry(id) {
  const log = await getTodayLog();
  log.entries = log.entries.filter(e => e.id !== id);
  await set(`log_${log.date}__${_pid}`, log);
  return log;
}

export async function copyDayEntries(fromDate, toDate) {
  const src = await getLogForDate(fromDate);
  if (!src.entries.length) return null;
  const dst = await getLogForDate(toDate);
  const newEntries = src.entries.map(e => ({ ...e, id: Date.now() + (Math.random() * 9999 | 0) }));
  dst.entries = [...dst.entries, ...newEntries];
  await set(`log_${toDate}__${_pid}`, dst);
  return dst;
}

export function sumLog(log) {
  return log.entries.reduce(
    (acc, e) => {
      const g = e.amount ?? 100;
      return {
        kcal:    acc.kcal    + Math.round((e.kcal_100g    ?? e.kcal    ?? 0) * g / 100),
        protein: acc.protein + Math.round((e.protein_100g ?? e.protein ?? 0) * g / 100 * 10) / 10,
        carbs:   acc.carbs   + Math.round((e.carbs_100g   ?? e.carbs   ?? 0) * g / 100 * 10) / 10,
        fat:     acc.fat     + Math.round((e.fat_100g     ?? e.fat     ?? 0) * g / 100 * 10) / 10,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function sumByMeal(log) {
  const result = { fruehstueck: 0, mittagessen: 0, abendessen: 0, snack: 0, getraenke: 0, unset: 0 };
  for (const e of log.entries) {
    const kcal = Math.round((e.kcal_100g ?? e.kcal ?? 0) * (e.amount ?? 100) / 100);
    result[e.meal_type ?? 'unset'] = (result[e.meal_type ?? 'unset'] ?? 0) + kcal;
  }
  return result;
}

export function entriesByMeal(log) {
  const result = { fruehstueck: [], mittagessen: [], abendessen: [], snack: [], getraenke: [], unset: [] };
  for (const e of log.entries) {
    const key = e.meal_type ?? 'unset';
    (result[key] ?? result.unset).push(e);
  }
  return result;
}

// ── Streak ────────────────────────────────────────────────
export async function getStreak() {
  const todayLog = await getLogForDate(today());
  const startIdx = sumLog(todayLog).kcal > 50 ? 0 : 1;
  let streak = 0;
  for (let i = startIdx; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const log = await getLogForDate(d.toISOString().split('T')[0]);
    if (sumLog(log).kcal > 50) { streak++; } else { break; }
  }
  return streak;
}

// ── Saved Meals ───────────────────────────────────────────
export async function getSavedMeals() {
  return (await get(pk('saved_meals'))) ?? [];
}
export async function saveMeal(meal) {
  const meals = await getSavedMeals();
  await set(pk('saved_meals'), [{ ...meal, id: Date.now(), favorite: false }, ...meals].slice(0, 50));
}
export async function deleteMeal(id) {
  const meals = await getSavedMeals();
  await set(pk('saved_meals'), meals.filter(m => m.id !== id));
}
export async function updateMeal(id, changes) {
  const meals = await getSavedMeals();
  await set(pk('saved_meals'), meals.map(m => m.id === id ? { ...m, ...changes } : m));
}
export async function toggleFavorite(id) {
  const meals = await getSavedMeals();
  await set(pk('saved_meals'), meals.map(m => m.id === id ? { ...m, favorite: !m.favorite } : m));
}

// ── Shopping List (shared across all profiles) ────────────
export async function getShoppingList() {
  return (await get('shopping')) ?? [];
}
export async function saveShoppingList(items) {
  await set('shopping', items);
}
export async function addShoppingItems(newItems) {
  const current = await getShoppingList();
  const merged  = [...current];
  for (const item of newItems) {
    const exists = merged.find(i => i.name.toLowerCase() === item.name.toLowerCase());
    if (!exists) merged.push({ ...item, id: Date.now() + Math.random(), checked: false, category: categorize(item.name) });
  }
  await set('shopping', merged);
  return merged;
}
export async function toggleShoppingItem(id) {
  const items   = await getShoppingList();
  const updated = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
  await set('shopping', updated);
  return updated;
}
export async function deleteShoppingItem(id) {
  const items = await getShoppingList();
  await set('shopping', items.filter(i => i.id !== id));
}

export function categorize(name) {
  const n = name.toLowerCase();
  if (/hähnchen|huhn|rind|hackfleisch|steak|lachs|thunfisch|fleisch|wurst|schinken|speck|pute|kabeljau|garnelen|fisch|meeresfrüchte/.test(n)) return 'fleisch';
  if (/brokkoli|spinat|karotte|kartoffel|tomate|gurke|salat|paprika|zwiebel|knoblauch|zucchini|aubergine|blumenkohl|mais|erbsen|bohnen|pilze|lauch|sellerie|kohl/.test(n)) return 'gemüse';
  if (/apfel|banane|beere|zitrone|orange|mango|ananas|traube|erdbeere|himbeere|kirsche|pfirsich|birne|melone/.test(n)) return 'obst';
  if (/milch|joghurt|käse|quark|sahne|butter|\bei\b|eier|mozzarella|parmesan|frischkäse/.test(n)) return 'milch';
  if (/reis|nudel|pasta|brot|mehl|hafer|quinoa|couscous|toast|müsli|cornflakes/.test(n)) return 'getreide';
  if (/öl|essig|sauce|soße|ketchup|senf|mayo|gewürz|salz|pfeffer|zucker|honig|dose|konserv/.test(n)) return 'vorrat';
  return 'sonstiges';
}

// ── Week History ──────────────────────────────────────────
export async function getWeekLogs() {
  const days = [];
  const now  = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    days.push({ date, sum: sumLog(await getLogForDate(date)) });
  }
  return days;
}

// ── Body Data ──────────────────────────────────────────────
export async function getBodyData() {
  return (await get(pk('body_data'))) ?? { weightKg: null, heightCm: null, targetWeightKg: null };
}
export async function saveBodyData(data) {
  await set(pk('body_data'), data);
}
export async function addWeightEntry(weightKg) {
  const date    = today();
  const history = await getWeightHistory();
  const updated = history.filter(e => e.date !== date);
  updated.push({ date, weightKg });
  updated.sort((a, b) => a.date.localeCompare(b.date));
  await set(pk('weight_history'), updated.slice(-90));
  await set(pk('body_data'), { ...(await getBodyData()), weightKg });
}
export async function getWeightHistory() {
  return (await get(pk('weight_history'))) ?? [];
}

// ── Week Plan (shared — family dinner) ────────────────────
export async function getWeekPlan(weekStart) {
  return (await get(`weekplan_${weekStart}`)) ?? null;
}
export async function saveWeekPlan(weekStart, plan) {
  await set(`weekplan_${weekStart}`, plan);
}

// ── Disliked Ingredients ──────────────────────────────────
export async function getDislikedIngredients() {
  return (await get(pk('disliked_ingredients'))) ?? [];
}
export async function saveDislikedIngredients(list) {
  await set(pk('disliked_ingredients'), list);
}

// ── Food History ──────────────────────────────────────────
export async function getFoodHistory() {
  return (await get(pk('food_history'))) ?? [];
}
export async function updateFoodHistory(product) {
  const history = await getFoodHistory();
  const key     = `${product.name}|${product.brand ?? ''}`.toLowerCase();
  const idx     = history.findIndex(h => `${h.name}|${h.brand ?? ''}`.toLowerCase() === key);
  if (idx >= 0) {
    history[idx] = { ...history[idx], count: history[idx].count + 1, lastUsed: Date.now() };
  } else {
    history.unshift({ ...product, count: 1, lastUsed: Date.now() });
  }
  history.sort((a, b) => b.count !== a.count ? b.count - a.count : b.lastUsed - a.lastUsed);
  await set(pk('food_history'), history.slice(0, 40));
}

// ── Achievements ──────────────────────────────────────────
const _achDefault = () => ({
  xp: 0,
  unlocked: [],
  stats: {
    totalMeals: 0, daysInGoal: 0, daysInGoalStreak: 0,
    proteinDaysHit: 0, waterDaysHit: 0, fastingCompleted: 0,
    recipesGenerated: 0, lastCheckedDate: null, lastWaterGoalDate: null,
  },
});
export async function getAchData()   { return (await get('achievements_data')) ?? _achDefault(); }
export async function saveAchData(d) { await set('achievements_data', d); }

import { get, set, del, keys } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

const today = () => new Date().toISOString().split('T')[0];

// ── Settings ──────────────────────────────────────────────
export async function getSettings() {
  return (await get('settings')) ?? { dailyGoal: 2000, apiKey: '' };
}

export async function saveSettings(s) {
  await set('settings', s);
}

// ── Daily Food Log ────────────────────────────────────────
export async function getTodayLog() {
  const date = today();
  return (await get(`log_${date}`)) ?? { date, entries: [] };
}

export async function getLogForDate(date) {
  return (await get(`log_${date}`)) ?? { date, entries: [] };
}

export async function addFoodEntry(entry) {
  const log = await getTodayLog();
  log.entries.push({ ...entry, id: Date.now() });
  await set(`log_${log.date}`, log);
  return log;
}

export async function removeFoodEntry(id) {
  const log = await getTodayLog();
  log.entries = log.entries.filter(e => e.id !== id);
  await set(`log_${log.date}`, log);
  return log;
}

export function sumLog(log) {
  return log.entries.reduce(
    (acc, e) => ({
      kcal:    acc.kcal    + (e.kcal    ?? 0),
      protein: acc.protein + (e.protein ?? 0),
      carbs:   acc.carbs   + (e.carbs   ?? 0),
      fat:     acc.fat     + (e.fat     ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// ── Saved Meals ───────────────────────────────────────────
export async function getSavedMeals() {
  return (await get('saved_meals')) ?? [];
}

export async function saveMeal(meal) {
  const meals = await getSavedMeals();
  const updated = [{ ...meal, id: Date.now() }, ...meals].slice(0, 30);
  await set('saved_meals', updated);
}

export async function deleteMeal(id) {
  const meals = await getSavedMeals();
  await set('saved_meals', meals.filter(m => m.id !== id));
}

// ── Shopping List ─────────────────────────────────────────
export async function getShoppingList() {
  return (await get('shopping')) ?? [];
}

export async function saveShoppingList(items) {
  await set('shopping', items);
}

export async function addShoppingItems(newItems) {
  const current = await getShoppingList();
  const merged = [...current];
  for (const item of newItems) {
    const exists = merged.find(i => i.name.toLowerCase() === item.name.toLowerCase());
    if (!exists) merged.push({ ...item, id: Date.now() + Math.random(), checked: false });
  }
  await set('shopping', merged);
  return merged;
}

export async function toggleShoppingItem(id) {
  const items = await getShoppingList();
  const updated = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
  await set('shopping', updated);
  return updated;
}

export async function deleteShoppingItem(id) {
  const items = await getShoppingList();
  const updated = items.filter(i => i.id !== id);
  await set('shopping', updated);
  return updated;
}

// ── Week history (for streak) ─────────────────────────────
export async function getWeekLogs() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split('T')[0];
    const log = await getLogForDate(date);
    days.push({ date, sum: sumLog(log) });
  }
  return days;
}

// ── Open Food Facts ───────────────────────────────────────
export async function searchFood(query) {
  const fields = 'product_name,nutriments,brands,quantity,serving_size,serving_quantity';
  const base   = 'https://world.openfoodfacts.org/cgi/search.pl';
  const q      = encodeURIComponent(query);
  const params = `json=1&page_size=20&fields=${fields}&sort_by=popularity_key&lc=de`;

  // Parallel: German products first, then global for broader coverage
  const [deData, worldData] = await Promise.all([
    fetch(`${base}?search_terms=${q}&countries_tags=en:germany&${params}`)
      .then(r => r.json()).catch(() => ({ products: [] })),
    fetch(`${base}?search_terms=${q}&${params}`)
      .then(r => r.json()).catch(() => ({ products: [] })),
  ]);

  const isValid    = p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null;
  const mapProduct = p => ({
    name:             p.product_name,
    brand:            p.brands ?? '',
    quantity:         p.quantity ?? '',
    serving_size:     p.serving_size ?? '',
    serving_quantity: p.serving_quantity ? Math.round(p.serving_quantity) : null,
    kcal_100g:        Math.round(p.nutriments['energy-kcal_100g'] ?? 0),
    protein_100g:     Math.round((p.nutriments['proteins_100g']       ?? 0) * 10) / 10,
    carbs_100g:       Math.round((p.nutriments['carbohydrates_100g']  ?? 0) * 10) / 10,
    fat_100g:         Math.round((p.nutriments['fat_100g']            ?? 0) * 10) / 10,
  });

  const seen   = new Set();
  const result = [];
  // German products first, then world results for fallback
  for (const p of [
    ...(deData.products    ?? []).filter(isValid).map(mapProduct),
    ...(worldData.products ?? []).filter(isValid).map(mapProduct),
  ]) {
    const key = `${p.name}|${p.brand}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); result.push(p); }
  }
  return result.slice(0, 15);
}

// ── Open Food Facts — Barcode ─────────────────────────────
export async function lookupBarcode(barcode) {
  const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  if (!res.ok) throw new Error('Netzwerkfehler');
  const data = await res.json();
  if (data.status !== 1 || !data.product) throw new Error('Produkt nicht gefunden');
  const p = data.product;
  return {
    name:             p.product_name || p.product_name_de || 'Unbekanntes Produkt',
    brand:            p.brands ?? '',
    quantity:         p.quantity ?? '',
    serving_size:     p.serving_size ?? '',
    serving_quantity: p.serving_quantity ? Math.round(p.serving_quantity) : null,
    kcal_100g:        Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
    protein_100g:     Math.round((p.nutriments?.['proteins_100g']       ?? 0) * 10) / 10,
    carbs_100g:       Math.round((p.nutriments?.['carbohydrates_100g']  ?? 0) * 10) / 10,
    fat_100g:         Math.round((p.nutriments?.['fat_100g']            ?? 0) * 10) / 10,
  };
}

// ── Claude API — Recipe Generator ────────────────────────
export async function generateRecipe(apiKey, { kcal, preference, meals = 1, phase = null }) {
  let phaseText = '';
  if (phase) {
    phaseText = `\nErnährungsphase: ${phase.label} — ${phase.desc}. Makroziele: Protein ${phase.macros.protein}%, Kohlenhydrate ${phase.macros.carbs}%, Fett ${phase.macros.fat}%.`;
  }

  const prompt = `Erstelle ${meals === 1 ? 'ein Rezept' : `${meals} Rezepte`} für insgesamt ca. ${kcal} Kalorien (${preference}).${phaseText}
Antworte NUR mit validem JSON — kein Markdown, kein erklärender Text.
Format für ein Rezept:
{"name":"Rezeptname","zutaten":[{"name":"Zutat","menge":100,"einheit":"g","kcal":150}],"anleitung":"Kochschritte als Text","gesamt_kcal":${kcal}}
${meals > 1 ? `Format für mehrere: Array von Rezepten: [{...}, {...}]` : ''}`;

  const data = await _callClaude(apiKey, prompt, 2048);
  const text = data.content[0].text.trim();
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('Claude hat kein gültiges JSON zurückgegeben');
  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ── Claude API — Weekly Dinner Plan ──────────────────────
export async function generateWeeklyMeals(apiKey, { phase = null, disliked = [], dinnerKcal = 1100, people = 1 }) {
  const dislikedStr = disliked.length
    ? `\nVERBOTEN (mag ich nicht): ${disliked.join(', ')}` : '';
  const phaseStr = phase
    ? `\nErnährungsphase: ${phase.label} — ${phase.desc}. Makroziele: Protein ${phase.macros.protein}%, Kohlenhydrate ${phase.macros.carbs}%, Fett ${phase.macros.fat}%.` : '';
  const peopleStr = people > 1
    ? `\nFamiliengröße: ${people} Personen. Alle Zutatenmengen für ${people} Personen angeben.` : '';

  const prompt = `Erstelle 7 verschiedene Abendessen-Rezepte für einen Wochenplan.

Kontext: Die Person trinkt morgens einen Protein-Shake (300 kcal, ~35g Protein) und mittags einen Clear-Protein-Shake (300 kcal, ~40g Protein). Das Abendessen ist die einzige richtige Mahlzeit.${phaseStr}${dislikedStr}${peopleStr}

Anforderungen:
- Jedes Rezept: ca. ${dinnerKcal} Kalorien${people > 1 ? ` (gesamt für ${people} Personen)` : ''}
- Mind. ${people > 1 ? people * 60 : 60}g Protein pro Rezept
- 7 VÖLLIG verschiedene Rezepte (verschiedene Länderküchen, Proteinquellen, Garmethoden)

Antworte NUR mit validem JSON ohne Markdown:
{"recipes":[{"name":"...","kcal":${dinnerKcal},"protein":70,"carbs":80,"fat":40,"zutaten":[{"name":"...","menge":"200","einheit":"g","kcal":300}],"anleitung":"..."}]}`;

  const data = await _callClaude(apiKey, prompt, 6000);
  const text = data.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Kein gültiges JSON erhalten');
  return JSON.parse(jsonMatch[0]).recipes ?? [];
}

// ── Claude API — Meal Plan ────────────────────────────────
export async function generateMealPlan(apiKey, { dailyKcal, days, preference }) {
  const prompt = `Erstelle einen Essensplan für ${days} Tage mit je ca. ${dailyKcal} Kalorien pro Tag (${preference}).
Antworte NUR mit validem JSON-Array — kein Markdown, kein erklärender Text.
Format:
[{"tag":1,"fruehstueck":"...","mittagessen":"...","abendessen":"...","snack":"...","gesamt_kcal":${dailyKcal}}]`;

  const data = await _callClaude(apiKey, prompt, 1024);
  const text = data.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Kein gültiges JSON erhalten');
  return JSON.parse(jsonMatch[0]);
}

// ── Claude API — Nutrition Advisor (Chat) ─────────────────
export async function askNutritionQuestion(apiKey, question, { kcal = 0, goal = 2000, protein = 0, profileName = 'du' } = {}) {
  const prompt = `Du bist ein persönlicher Ernährungsberater für ${profileName}.
Aktuelle Daten heute: ${kcal} von ${goal} kcal getrackt, ${protein}g Protein.

Frage: ${question}

Antworte kurz, präzise und auf Deutsch. Maximal 4 Sätze.`;

  const data = await _callClaude(apiKey, prompt, 512);
  return data.content[0].text.trim();
}

// ── Internal helper ───────────────────────────────────────
async function _callClaude(apiKey, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API-Fehler ${res.status}`);
  }
  return res.json();
}

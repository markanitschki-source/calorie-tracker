// ── Open Food Facts ───────────────────────────────────────
export async function searchFood(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15&fields=product_name,nutriments,brands,quantity`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Netzwerkfehler');
  const data = await res.json();

  return (data.products ?? [])
    .filter(p => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
    .map(p => ({
      name:         p.product_name,
      brand:        p.brands ?? '',
      quantity:     p.quantity ?? '',
      kcal_100g:    Math.round(p.nutriments['energy-kcal_100g'] ?? 0),
      protein_100g: Math.round((p.nutriments['proteins_100g'] ?? 0) * 10) / 10,
      carbs_100g:   Math.round((p.nutriments['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat_100g:     Math.round((p.nutriments['fat_100g'] ?? 0) * 10) / 10,
    }))
    .slice(0, 10);
}

// ── Open Food Facts — Barcode Lookup ─────────────────────
export async function lookupBarcode(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  if (!res.ok) throw new Error('Netzwerkfehler');
  const data = await res.json();
  if (data.status !== 1 || !data.product) throw new Error('Produkt nicht gefunden');
  const p = data.product;
  return {
    name:         p.product_name || p.product_name_de || 'Unbekanntes Produkt',
    brand:        p.brands ?? '',
    quantity:     p.quantity ?? '',
    kcal_100g:    Math.round(p.nutriments?.['energy-kcal_100g'] ?? 0),
    protein_100g: Math.round((p.nutriments?.['proteins_100g'] ?? 0) * 10) / 10,
    carbs_100g:   Math.round((p.nutriments?.['carbohydrates_100g'] ?? 0) * 10) / 10,
    fat_100g:     Math.round((p.nutriments?.['fat_100g'] ?? 0) * 10) / 10,
  };
}

// ── Claude API — Recipe Generator ────────────────────────
export async function generateRecipe(apiKey, { kcal, preference, meals = 1, phase = null }) {
  let phaseText = '';
  if (phase) {
    phaseText = `\nErnährungsphase: ${phase.label} — ${phase.desc}. Makroziele: Protein ${phase.macros.protein}%, Kohlenhydrate ${phase.macros.carbs}%, Fett ${phase.macros.fat}%.`;
  }

  const prompt = `Erstelle ${meals === 1 ? 'ein Rezept' : `${meals} Rezepte`} für insgesamt ca. ${kcal} Kalorien (${preference}).${phaseText}
Antworte NUR mit validem JSON — kein Markdown, kein erklärender Text davor oder danach.
Format für ein Rezept:
{"name":"Rezeptname","zutaten":[{"name":"Zutat","menge":100,"einheit":"g","kcal":150}],"anleitung":"Kochschritte als Text","gesamt_kcal":${kcal}}
${meals > 1 ? `Format für mehrere Rezepte: Array von Rezepten: [{...}, {...}]` : ''}`;

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
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API-Fehler ${res.status}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim();

  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('Claude hat kein gültiges JSON zurückgegeben');

  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ── Claude API — Meal Plan ────────────────────────────────
export async function generateMealPlan(apiKey, { dailyKcal, days, preference }) {
  const prompt = `Erstelle einen Essensplan für ${days} Tage mit je ca. ${dailyKcal} Kalorien pro Tag (${preference}).
Antworte NUR mit validem JSON-Array — kein Markdown, kein erklärender Text.
Format:
[{"tag":1,"fruehstueck":"...","mittagessen":"...","abendessen":"...","snack":"...","gesamt_kcal":${dailyKcal}}]`;

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
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `API-Fehler ${res.status}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Kein gültiges JSON erhalten');
  return JSON.parse(jsonMatch[0]);
}

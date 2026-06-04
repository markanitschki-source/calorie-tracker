import { FOODS_DE } from './data/foods-de.js';

// Englisch/Tipp-Aliase → normalisiertes Deutsch
const ALIASES = new Map([
  ['chicken',     'haehnchen'], ['haehnchen', 'haehnchen'],
  ['egg',         'ei'],        ['eggs', 'ei'],
  ['salmon',      'lachs'],
  ['tuna',        'thunfisch'],
  ['yogurt',      'joghurt'],   ['yoghurt', 'joghurt'],
  ['quark',       'quark'],
  ['bread',       'brot'],
  ['rice',        'reis'],
  ['pasta',       'nudeln'],    ['noodles', 'nudeln'],
  ['potato',      'kartoffel'], ['potatoes', 'kartoffel'],
  ['milk',        'milch'],
  ['cheese',      'kaese'],
  ['apple',       'apfel'],
  ['banana',      'banane'],
  ['broccoli',    'brokkoli'],
  ['spinach',     'spinat'],
  ['carrot',      'karotte'],   ['carrots', 'karotten'],
  ['tomato',      'tomate'],    ['tomatoes', 'tomaten'],
  ['oats',        'haferflocken'],
  ['almonds',     'mandeln'],   ['almond', 'mandeln'],
  ['walnuts',     'walnuesse'], ['walnut', 'walnuesse'],
  ['cashew',      'cashews'],
  ['beef',        'rind'],
  ['pork',        'schwein'],
  ['turkey',      'pute'],
  ['fish',        'fisch'],
  ['oil',         'oel'],
  ['avocado',     'avocado'],
  ['strawberry',  'erdbeere'],  ['strawberries', 'erdbeeren'],
  ['blueberry',   'blaubeere'], ['blueberries', 'blaubeeren'],
  ['raspberry',   'himbeere'],  ['raspberries', 'himbeeren'],
  ['orange',      'orange'],
  ['lemon',       'zitrone'],
  ['mango',       'mango'],
  ['cucumber',    'gurke'],
  ['zucchini',    'zucchini'],
  ['pepper',      'paprika'],
  ['onion',       'zwiebel'],
  ['garlic',      'knoblauch'],
  ['mushroom',    'champignon'],['mushrooms', 'champignons'],
  ['salad',       'salat'],     ['lettuce', 'salat'],
  ['cream',       'sahne'],
  ['chocolate',   'schokolade'],
  ['chips',       'chips'],
  ['nuts',        'nuesse'],
  ['peanuts',     'erdnuesse'], ['peanut', 'erdnuss'],
  ['lentils',     'linsen'],
  ['chickpeas',   'kichererbsen'],
  ['beans',       'bohnen'],
  ['tofu',        'tofu'],
  ['mcdonalds',   'mcdonald'],  ['mc', 'mcdonald'],
  ['bk',          'burger king'],
  ['kfc',         'kfc'],
  ['mcdo',        'mcdonald'],
  ['burger',      'burger'],
  ['doner',       'doener'],    ['döner', 'doener'],
  ['shake',       'shake'],     ['shakes', 'shake'],
  ['joghur',      'joghurt'],                             // Tippfehler-Toleranz
  ['joghurt',     'joghurt'],
  ['youghurt',    'joghurt'],
]);

function normalize(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function guessEmoji(name) {
  const n = String(name).toLowerCase();
  if (/shake|protein|whey|casein|pulver|powder/.test(n)) return '🥤';
  if (/riegel|bar\b|sportriegel/.test(n))                return '🍫';
  if (/ei\b|eier|egg/.test(n))                          return '🥚';
  if (/hafer|oat|müsli|muesli|granola|porridge/.test(n))return '🌾';
  if (/hähnchen|hühnchen|chicken|pute|turkey/.test(n))  return '🍗';
  if (/steak|rind|beef|hackfleisch|schwein|pork|wurst|schinken|speck/.test(n)) return '🥩';
  if (/lachs|salmon|thunfisch|tuna|fisch|fish|garnele|meeresfrüchte/.test(n)) return '🐟';
  if (/brot|toast|brötchen|bread|croissant|bagel/.test(n)) return '🍞';
  if (/nudel|pasta|spaghetti|noodle/.test(n))           return '🍝';
  if (/reis|rice/.test(n))                              return '🍚';
  if (/kartoffel|potato/.test(n))                       return '🥔';
  if (/joghurt|yogurt|quark/.test(n))                   return '🥛';
  if (/milch|milk/.test(n))                             return '🥛';
  if (/käse|cheese/.test(n))                            return '🧀';
  if (/butter|margarine/.test(n))                       return '🧈';
  if (/apfel|apple/.test(n))                            return '🍎';
  if (/banane|banana/.test(n))                          return '🍌';
  if (/beere|berry|erdbeere|himbeere|blaubeere/.test(n))return '🫐';
  if (/orange|mandarine/.test(n))                       return '🍊';
  if (/zitrone|lemon/.test(n))                          return '🍋';
  if (/mango/.test(n))                                  return '🥭';
  if (/avocado/.test(n))                                return '🥑';
  if (/brokkoli|broccoli|spinat|spinach|salat|lettuce|gurke|zucchini|paprika|tomate|karotte|sellerie|kohl/.test(n)) return '🥦';
  if (/nuss|nüsse|mandel|almond|cashew|walnuss|erdnuss|peanut/.test(n)) return '🥜';
  if (/öl|oil|olivenöl/.test(n))                        return '🫙';
  if (/kaffee|coffee|espresso|cappuccino|latte/.test(n))return '☕';
  if (/tee|tea/.test(n))                                return '🍵';
  if (/saft|juice/.test(n))                             return '🧃';
  if (/wasser|water/.test(n))                           return '💧';
  if (/bier|beer/.test(n))                              return '🍺';
  if (/wein|wine/.test(n))                              return '🍷';
  if (/suppe|soup|eintopf/.test(n))                     return '🍲';
  if (/pizza/.test(n))                                  return '🍕';
  if (/burger/.test(n))                                 return '🍔';
  if (/sandwich|wrap/.test(n))                          return '🥪';
  if (/schokolade|chocolate/.test(n))                   return '🍫';
  if (/kuchen|cake|muffin|cookie|keks/.test(n))         return '🍰';
  if (/linsen|kichererbse|bohnen|tofu/.test(n))         return '🫘';
  return '🍽️';
}

export function searchLocal(query) {
  if (!query || query.length < 2) return [];

  const normQ   = normalize(query);
  const expanded = ALIASES.get(normQ) ?? normQ;
  const tokens   = expanded.split(' ').filter(t => t.length >= 2);

  const results = [];

  for (const item of FOODS_DE) {
    const normName   = normalize(item.name);
    const normBrand  = normalize(item.brand ?? '');
    const target     = normBrand ? normName + ' ' + normBrand : normName;

    // Exakter Treffer
    if (normName === normQ || normName === expanded) {
      results.push({ item, score: 10000 }); continue;
    }
    // Name beginnt mit Query
    if (normName.startsWith(normQ) || normName.startsWith(expanded)) {
      results.push({ item, score: 5000 - normName.length }); continue;
    }

    let score = 0;
    let matched = 0;

    for (const token of tokens) {
      if (target.includes(token)) {
        score += token.length * 4;
        matched++;
      } else {
        // Präfix-Match: token ist Anfang eines Wortes
        const words = target.split(' ');
        const pfx = token.length >= 3 && words.some(w => w.startsWith(token));
        if (pfx) { score += token.length * 2; matched++; }
      }
    }

    // Bonus: alle Tokens gefunden
    if (matched > 0 && matched === tokens.length && tokens.length > 1) score += 30;
    // Malus: Brand-Treffer statt Name-Treffer
    if (matched > 0 && !normName.includes(tokens[0]) && normBrand.includes(tokens[0])) score -= 5;

    if (score > 0) results.push({ item, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(r => r.item);
}

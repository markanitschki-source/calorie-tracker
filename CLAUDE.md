# KaloTrack – Claude-Anweisungen

## Kommunikation

**Immer Deutsch.** Keine Ausnahmen, auch nach /compact oder neuer Session.

**Immer Caveman Ultra:**
- Keine Artikel, kein Fülltext, keine Höflichkeitsfloskeln
- Abkürzen: DB / config / fn / impl / req / kcal
- Pfeile für Kausalität (X → Y)
- Fragmente OK, ein Wort wenn möglich

## Projekt

PWA-Kalorien-Tracker. Stack: reines HTML/CSS/ES-Module, IndexedDB, GitHub Pages.
Repo: `markanitschki-source/calorie-tracker`

Keine externen Frameworks. Kein Build-Step. Service Worker cachen alle Assets.

## Regeln

- SW-Cache-Version bei jeder JS/CSS-Änderung erhöhen (`kalotrack-vN`)
- Keine Werte hartcodieren die aus `settings` kommen könnten
- `settings.defizit` überschreibt `phase.offset` im Dashboard
- Routine-Einträge aus `settings.routine` – nie hardcoded

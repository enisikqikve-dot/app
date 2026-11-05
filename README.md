# eNis

Ein Lebens-Simulator im Browser, in dem du ein unsichtbarer Gott bist. Auf
einem kleinen, runden Planeten leben, lieben, arbeiten, erfinden und streiten
die Menschen von selbst, von der Steinzeit bis in eine verrückte
Sci-Fi-Zukunft. Du schaust zu und greifst mit gewaltigen Kräften ein, wann du
willst.

👉 Das vollständige Spielkonzept steht in [KONZEPT.md](KONZEPT.md).

## Stand: Meilenstein 1 – Erster Planet ✅

- **Zufälliger 3D-Planet** aus einem Welt-Code:
  - Kontinente, Inseln, Gebirge, Flachwasser und Tiefsee
  - 14 Landschaften, von Regenwald bis ewigem Eis
  - drei Größen
- **Echte Sonne:**
  - Eine Hälfte des Planeten ist Tag, die andere Nacht.
  - Die schräge Achse sorgt für Jahreszeiten.
- **Jahreszeiten:**
  - Im Winter kommen Schnee und Packeis.
  - Laubwälder werden im Herbst orange.
- **Gott-Kamera** für Maus, Touch und Tastatur: vom Weltall bis zu den Baumwipfeln.
  Nah am Boden wird der Himmel blau.
- **Zeit:** Pause, 1×, 10×, 100×, 1000×. Ab 100× gilt Zeitraffer mit gemitteltem Sonnenlicht.
- **Orte ansehen:** Klick oder Tippen zeigt Landschaft, Höhe, Temperatur, Klimazone und Ortszeit.
- **Welt-Code** zum Teilen, z.B. `ENIS-36YQ-0JVM`. Der Code steht auch im Link (`#ENIS-…`).
- **Sprache:** Deutsch und Englisch.
- Der Spielstand wird im Browser gemerkt.

Die Götterkräfte sind schon zu sehen, aber noch gesperrt. Sie kommen ab Meilenstein 2.

## Entwickeln

```bash
npm install
npm run dev             # Entwicklungsserver
npm test                # Tests (Vitest)
npm run typecheck       # TypeScript prüfen
npm run build           # Build nach dist/
npm run build:artifact  # alles in einer HTML-Datei (zum Teilen als Link)
```

## Aufbau

```
src/
  core/        Zufall mit Seed, Welt-Codes, Planetennamen, kleiner Store
  sim/         Spiel-Logik ohne Grafik (später im Web Worker)
    clock.ts   Kalender, Geschwindigkeiten, Sonnenstand
    planet/    geodätisches Netz, Gelände, Klima, Landschaften
  render/      Three.js: Boden, Meer, Atmosphäre, Himmel, Bäume, Wolken, Kamera
  game/        Game: verbindet Simulation, Grafik und Oberfläche
  ui/          Oberfläche mit Preact
  i18n/        Texte auf Deutsch und Englisch
tests/         Unit-Tests
scripts/       Build-Hilfen
```

Technik: TypeScript, Vite, Three.js, Preact.

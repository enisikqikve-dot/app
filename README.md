# eNis

Ein Lebens-Simulator im Browser, in dem du ein unsichtbarer Gott bist. Auf
einem kleinen, runden Planeten leben, lieben, arbeiten, erfinden und streiten
die Menschen von selbst, von der Steinzeit bis in eine verrückte
Sci-Fi-Zukunft. Du schaust zu und greifst mit gewaltigen Kräften ein, wann du
willst.

👉 Das vollständige Spielkonzept steht in [KONZEPT.md](KONZEPT.md).

## Stand: Meilenstein 3 – Erstes Leben ✅

**Neu: Auf dem Planeten leben die ersten 6 Menschen und viele Tiere.**

- **Menschen mit Bedürfnissen:**
  - Sie haben Hunger, Durst und Müdigkeit.
  - Sie suchen Wasser und Beeren, schlafen nachts und fliehen vor Feuer, Lava und Flut.
  - Die Gruppe folgt einer Anführerin oder einem Anführer und zieht weiter, wenn das Essen knapp wird.
  - Der Tod hat echte Ursachen, und an der Stelle bleibt ein Grab.
- **Symbol-Blasen** über den Köpfen zeigen, was jemand gerade braucht oder tut (💧 🫐 💤 🤒 😱).
- **Akte:** Tippe auf einen Menschen. Du siehst Name, Alter, Aussehen, die Bedürfnisse als Balken und den Lebenslauf.
- **Folgen:** Die Kamera begleitet einen Menschen.
- **Tiere im Ökosystem:**
  - Es gibt Hirsche, Wildrinder, Mammuts und Wölfe in Herden.
  - Sie grasen, bekommen im Frühling Junge und wandern.
  - Wölfe jagen, und im Winter wird das Futter knapp.
- **Flüsse und Seen:** Das Wasser fließt bergab zum Meer und sammelt sich in Senken.

| Gruppe | Kräfte |
|---|---|
| Segen & Wunder | Reiche Ernte, Heilen, Wiederbeleben (bis 5 Tage nach dem Tod) |
| Leben & Tod | Menschen erschaffen (1, 2 oder 5), Unsichtbare Hand (tragen), Sterben lassen, Tiere aussetzen, Seuche |

- **Zurückspulen** stellt jetzt auch alle Menschen und Tiere wieder her, genau so, wie sie damals waren.
- Auf dem Handy rückt das Bild nach oben, damit die Akte niemanden verdeckt.

### Meilenstein 2 – Zorn & Natur ✅

**Neu: 14 Naturkräfte.** Du findest sie links unter „Natur“:

| Gruppe | Kräfte |
|---|---|
| Wetter | Blitz, Regen, Dürre, Feuer, Supersturm |
| Erde | Erdbeben, Vulkan, Flutwelle, Meteorit |
| Landschaft | Land heben, Land senken, Wald pflanzen (mit dem Finger oder der Maus malen) |
| Klima | Eiszeit, Hitzezeit (für den ganzen Planeten, über Jahrhunderte) |

- **Echte Folgen:**
  - Feuer breitet sich durch trockene Wälder aus, und Regen löscht es.
  - Lava fließt bergab, kühlt zu Gestein ab und setzt Wälder in Brand.
  - Flutwellen erreichen die Küsten zeitversetzt.
  - Meteoriten graben Krater, und ein Vulkan im Meer lässt eine neue Insel entstehen.
  - Verbrannte Wälder wachsen über Jahrzehnte nach.
  - Vulkanausbrüche und Einschläge verdunkeln den Himmel und kühlen den Planeten ab: Es gibt einen vulkanischen Winter oder einen Einschlagswinter.
- **Spektakuläre Effekte:**
  - Blitze, Meteor-Einschlag mit Druckwelle, Lava-Fontänen und Aschesäulen
  - Wirbelsturm-Spirale, Regenwolken, Flutwelle und Flammen
  - Kamerawackeln
- **Geräusche:** Donner, Grollen, Explosion, Welle, Wind, Regen und Feuerknistern. Alles ist im Code erzeugt, ohne Audiodateien, und lässt sich ausschalten.
- **Zurückspulen (⏪):** vor jede eingesetzte Kraft oder an den Beginn jedes 10. Jahres.
- Bei großen Katastrophen springt die Zeit auf 1×, damit du zusehen kannst.
- Die Orts-Infos zeigen jetzt auch Zustände wie „brennt“, „Lava“, „überflutet“ oder „Asche“.

### Meilenstein 1 – Erster Planet ✅

- Zufälliger 3D-Planet aus einem Welt-Code, mit 14 Landschaften und drei Größen
- Echte Sonne mit Tag und Nacht und Jahreszeiten, mit Schnee, Packeis und Herbstlaub
- Gott-Kamera für Maus, Touch und Tastatur; Zeit von Pause bis 1000×
- Orte ansehen, Welt-Code teilen, Deutsch und Englisch, Spielstand im Browser

## Entwickeln

```bash
npm install
npm run dev             # Entwicklungsserver
npm test                # Tests (Vitest)
npm run typecheck       # TypeScript prüfen
npm run build           # Build nach dist/
npm run build:artifact  # alles in einer HTML-Datei (zum Teilen als Link)
```

## Wie das Zurückspulen funktioniert

Die Welt ist immer **Startplanet + Liste der eingesetzten Kräfte**. Jede Kraft
wird mit Zeitpunkt, Ort und Zufallszahl gespeichert. Zurückspulen heißt: den
Startplaneten neu laden und nur die Kräfte vor dem gewählten Zeitpunkt noch
einmal anwenden. Das ist exakt reproduzierbar, die Tests prüfen es. Der
Spielstand ist deshalb sehr klein.

Seit Meilenstein 3 leben Menschen und Tiere auf dem Planeten. Ihr Leben läuft
in festen Schritten von 20 Spielminuten mit eigenem Zufall. Vor jeder Kraft und
alle paar Spieltage speichert das Spiel ein kleines Abbild davon. Beim
Zurückspulen lädt es das passende Abbild und rechnet von dort aus weiter. Auch
das ist exakt reproduzierbar.

## Aufbau

```
src/
  core/        Zufall mit Seed, Welt-Codes, Planetennamen, kleiner Store
  sim/         Spiel-Logik ohne Grafik (später im Web Worker)
    clock.ts   Kalender, Geschwindigkeiten, Sonnenstand
    planet/    geodätisches Netz, Gelände, Klima, Landschaften
    world.ts   Welt-Gedächtnis: Ereignisse, Narben (Feuer, Lava, Flut …), Klima
    life/      Menschen, Tierherden, Nahrung (feste Schritte, eigener Zufall)
    powers.ts  die Götterkräfte
  render/      Three.js: Boden, Meer, Flüsse, Atmosphäre, Himmel, Bäume, Wolken,
               Menschen, Tiere, Sprechblasen, Kamera
    fx/        Partikel und Effekte der Götterkräfte
  audio/       Geräusche (Web Audio, im Code erzeugt)
  game/        Game: verbindet Simulation, Grafik und Oberfläche
  ui/          Oberfläche mit Preact
  i18n/        Texte auf Deutsch und Englisch
tests/         Unit-Tests
scripts/       Build-Hilfen
```

Technik: TypeScript, Vite, Three.js, Preact.

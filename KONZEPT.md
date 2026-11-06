# eNis – Spielkonzept

> Ein Lebens-Simulator im Browser, in dem du ein unsichtbarer Gott bist.
> Auf einem kleinen Planeten leben, lieben, arbeiten, erfinden und streiten
> die Menschen von selbst, von der Steinzeit bis in eine verrückte
> Sci-Fi-Zukunft. Du schaust zu und greifst ein, wann du willst.

Stand: 6. November 2026 · Version 2.2 · Phase: Meilenstein 12 fertig (Lebendigere Menschen)

---

## Inhalt

1. [Die Idee](#1-die-idee)
2. [Deine Entscheidungen auf einen Blick](#2-deine-entscheidungen-auf-einen-blick)
3. [So könnte eine Partie aussehen](#3-so-könnte-eine-partie-aussehen)
4. [Der Planet](#4-der-planet)
5. [Die Menschen](#5-die-menschen)
6. [Wie sich die Welt von selbst entwickelt](#6-wie-sich-die-welt-von-selbst-entwickelt)
7. [Deine Kräfte als Gott](#7-deine-kräfte-als-gott)
8. [Beobachten: Was du sehen kannst](#8-beobachten-was-du-sehen-kannst)
9. [Die Zeit](#9-die-zeit)
10. [Bildschirm, Kamera & Steuerung](#10-bildschirm-kamera--steuerung)
11. [Grafik & Ton](#11-grafik--ton)
12. [Technik (für die Entwicklung)](#12-technik-für-die-entwicklung)
13. [Fahrplan](#13-fahrplan)
14. [Risiken und wie wir damit umgehen](#14-risiken-und-wie-wir-damit-umgehen)
15. [Noch offen](#15-noch-offen)

---

## 1. Die Idee

Du schaust auf einen kleinen, lebendigen Planeten, den du wie einen Globus
drehen kannst. Am Anfang gibt es dort nur eine Handvoll Steinzeitmenschen.
Sie haben Hunger, sie frieren, sie verlieben sich, bekommen Kinder und
sterben. Niemand sagt ihnen, was sie tun sollen: Jeder Mensch hat einen
eigenen Charakter und entscheidet selbst.

Über Tausende Jahre entdecken sie das Feuer, bauen Hütten, gründen Stämme,
erfinden die Schrift, führen Kriege und bauen Städte. Irgendwann gibt es
vielleicht Cyborgs, Klone und fliegende Städte.

Du bist ihr Gott, und du bist **unsichtbar**. Die Menschen sehen nur, was du
tust. Du kannst es regnen lassen, Kranke heilen, einem Menschen eine Idee
ins Ohr flüstern, einen Vulkan ausbrechen oder einen Meteoriten einschlagen
lassen. Am Anfang wissen die Menschen nicht, dass es dich gibt. Wenn sie
aber deine Wunder sehen, beginnen sie zu glauben.

**Das Spiel hat kein festes Ziel.** Es ist eine Sandbox. Die spannende Frage
ist: Was wird aus deiner Welt?

### Die drei Säulen

| Säule | Bedeutung |
|---|---|
| **⭐ Göttliche Macht** *(am wichtigsten)* | Gewaltige, spektakuläre Kräfte, die richtig Spaß machen. Deine Macht ist unbegrenzt, aber die Menschen behalten ihren freien Willen. |
| **Echtes Leben im Kleinen** | Jeder Mensch ist ein Individuum mit Charakter, Gefühlen, Gedächtnis, Familie und eigener Lebensgeschichte. |
| **Geschichte im Großen** | Aus vielen kleinen Entscheidungen entstehen von selbst Erfindungen, Wirtschaft, Religionen, Völker und Kriege. |

---

## 2. Deine Entscheidungen auf einen Blick

### Runde 1: Das Grundkonzept

| # | Frage | Deine Antwort |
|---|---|---|
| 1 | Plattform | **Browser** (PC und Handy, ohne Installation) |
| 2 | Grafik | **3D-Welt** |
| 3 | Menschen am Start | **Wenige (2–10)** |
| 4 | Epoche | **Steinzeit bis Zukunft** |
| 5 | Götterkräfte | **Alle:** Natur, Segen & Wunder, Gedanken flüstern, Leben & Tod |
| 6 | Eingreifen | **Ausgewogen:** Menschen leben selbstständig, du kannst jederzeit eingreifen |
| 7 | Wissen sie von dir? | **Sie entdecken es** durch deine Wunder und gründen Religionen |
| 8 | Grenzen der Macht | **Unbegrenzt** (Sandbox) |
| 9 | Bedürfnisse | **Alle:** Essen/Trinken/Schlaf, Liebe & Freundschaft, Gefühle, Gesundheit & Alter |
| 10 | Persönlichkeit | **Eigener Charakter** mit Eigenschaften und Gedächtnis (ohne KI-Kosten) |
| 11 | Familie | **Kinder mit Vererbung** und Stammbäumen über Generationen |
| 12 | Arbeit | **Nach Bedarf & Talent**, regelt sich von selbst |
| 13 | Erfindungen | **Von selbst**, Wissen kann auch verloren gehen |
| 14 | Wirtschaft | **Entwickelt sich:** Tausch, Geld, Märkte, Arm und Reich |
| 15 | Konflikte | **Alles:** Streit, Verbrechen, Kriege |
| 16 | Politik | **Entwickelt sich:** Stämme, Häuptlinge, Könige, Demokratie, mehrere Völker |
| 17 | Spielziel | **Freie Sandbox** |
| 18 | Zeit | **Pause und Vorspulen** |
| 19 | Infos | **Alles:** Lebensgeschichte, Weltchronik, Statistiken, Stammbaum |
| 20 | Umfang | **Erst der Plan**, dann bauen |
| + | Technik | **Web-3D mit Three.js** im Projekt `app` |

### Runde 2: Aussehen, Gefühl & Bedienung

| # | Frage | Deine Antwort |
|---|---|---|
| 1 | Am wichtigsten | **Götterkräfte**, die baue ich zuerst und am besten |
| 2 | Stimmung | **Natürlich:** echte Naturfarben, glaubwürdig |
| 3 | Menschen | **Minimal:** wie Spielfiguren ohne Gesicht, nur Farben und Formen |
| 4 | Weltform | **Kleiner Planet**, den du wie einen Globus drehst |
| 5 | Du als Gott | **Unsichtbar:** nur Kamera und Zeiger |
| 6 | Katastrophen | **Gewaltig:** können ganze Völker auslöschen |
| 7 | Überleben | **Leicht:** Die Menschen kommen gut alleine zurecht |
| 8 | Tempo | **Realistisch langsam:** Tausende Jahre Steinzeit |
| 9 | Menschen erschaffen | **Nur zufällig:** Du wählst nur den Ort |
| 10 | Sprechen | **Symbole in Sprechblasen** (❤️ 🍖 😠 💡) |
| 11 | Drama | **Normal:** wie im echten Leben, ab und zu etwas Großes |
| 12 | Tiere | **Evolution:** Ökosystem, und mit der Zeit entstehen neue Arten |
| 13 | Gerät | **Alles gleich:** PC, Handy und Tablet von Anfang an |
| 14 | Kamera | **Alle:** Gott-Ansicht, Folgen-Modus, Ich-Perspektive, Film-Modus |
| 15 | Erzählton | **Wie ein Geschichtsbuch:** klar und sachlich |
| 16 | Sprache | **Deutsch + Englisch**, umschaltbar |
| 17 | Ton | **Naturgeräusche + ruhige Musik**, die sich mit der Epoche ändert |
| 18 | Extras | **Zurückspulen, Zeitsprung, Welt teilen** |
| 19 | Zukunft | **Verrückte Sci-Fi:** Cyborgs, Klone, fliegende Städte, Zeitmaschinen |
| 20 | Name | **eNis** |

### Runde 3: Ausbau nach Version 2.0

| # | Frage | Deine Antwort |
|---|---|---|
| 1 | Tempo der Geschichte | **So lassen:** realistisch langsam |
| 2 | Zeitsprung | **Neu: bis zum nächsten großen Ereignis** |
| 3 | Meldungen | **So lassen** |
| 4 | Start einer Welt | **Startzahl wählbar** (2 bis 50 Menschen) |
| 5 | Neue Kräfte | **Alle:** Himmelsereignisse (Finsternis, Komet, Nordlicht), Wunderbauwerk, Träume an ein ganzes Volk, Tierwunder |
| 6 | Verehrung | **Opfer und Feste, Tempel für dich, sichtbare Gebete** (🙏🌧️) |
| 7 | Grenzen der Macht | **Unbegrenzt** (Sandbox) |
| 8 | Ziele | **Spiel ohne Ende:** keine Ziele, es läuft endlos weiter, auch nach der fernen Zukunft |
| 9 | Mehr Leben | **Alles:** Feste und Hochzeiten, Lebensträume, sichtbare Berufe, Freundschaften, Rivalen und Fehden |
| 10 | Aussehen der Menschen | **Viel mehr Details:** Arme, Beine, Gesichter, Bewegungen |
| 11 | Chronik | **Zusätzlich als Buch** mit Kapiteln je Epoche; die Liste bleibt |
| 12 | Kartenansichten | **Völker und Grenzen, Bevölkerung, Klima und Nahrung** |
| 13 | Wetter | **Regen und Schnee, Schnee auf Dächern, Nebel und Gewitter** |
| 14 | Weltall | **Raumfahrt mit Mondbasis und Satelliten** |
| 15 | Grafik | **Qualität wählbar** (niedrig / mittel / hoch) |
| 16 | Spielstände | **Automatische Sicherungen** (alle 1000 Jahre) |
| 17 | Sprachen | **Deutsch und Englisch reichen** |
| 18 | Musik | **So lassen** |
| 19 | Handy | **Einfacher Modus:** weniger Knöpfe, Kräfte im Ring um den Finger |
| 20 | Zuerst bauen | **Lebendigere Menschen** |

---

## 3. So könnte eine Partie aussehen

*Ein erfundenes Beispiel, damit man spürt, wie sich das Spiel anfühlt. Was
wirklich passiert, ist jedes Mal anders.*

- **Jahr 1:** Du drehst deinen Planeten und suchst ein grünes Flusstal in den
  warmen Breiten. Dort setzt du sechs Menschen ab. **Ara** ist neugierig und
  mutig, **Tok** ist freundlich, aber faul. Sie sammeln Beeren, trinken am
  Fluss und schlafen nachts unter einer großen Eiche.
- **Jahr 3:** Ara und Tok bekommen ihr erstes Kind, **Mina**. Sie hat Aras
  Neugier und Toks dunkle Haare geerbt.
- **Jahr 19:** Ein Gewitter. Ein Blitz schlägt in eine Eiche ein. Die anderen
  laufen weg, aber Mina (16) traut sich näher und nimmt einen brennenden Ast
  mit. In der Chronik steht: *„Jahr 19: Mina entdeckt das Feuer.“* Das war
  Glück, denn sonst hätte es vielleicht Jahrhunderte gedauert.
- **Jahr 160:** Die Gruppe ist auf 40 Menschen gewachsen. Zwei Familien
  streiten um die Jagdgründe. Toks Nachkommen ziehen flussaufwärts und
  gründen den Stamm der **Tokar**.
- **Jahr 230:** Eine lange Dürre. Ein alter, frommer Mann tanzt und ruft zum
  Himmel. Genau in diesem Moment lässt du es regnen. Die Menschen sind
  überzeugt: *„Der Himmelsgeist hat uns erhört.“* Der alte Mann wird der erste
  Schamane.
- **Jahr 1.400:** Du lässt den großen Berg im Osten ausbrechen. Asche
  verdunkelt den Himmel, und zwei Jahre lang gibt es keinen Sommer. Die Tokar
  überleben in Höhlen, viele andere nicht. In ihren Legenden wird der Berg zum
  Sitz eines zornigen Gottes. *War das zu viel? Dann spulst du einfach fünf
  Jahre zurück.*
- **Zeitsprung +2.000 Jahre.**
- **Jahr 3.600:** Am Fluss bauen die Menschen Getreide an und werden
  sesshaft. Ein Dorf entsteht, und mit ihm das erste Eigentum und der erste
  Dieb.
- **Jahr 6.200:** Zwei Völker, zwei Religionen, ein Krieg um das fruchtbare
  Tal. Du kannst zuschauen, einem Anführer Frieden ins Ohr flüstern oder die
  Erde beben lassen.
- **Jahr 9.800:** Über den Ozeanen schweben Städte. Klone und KI-Wesen
  streiten darüber, ob es dich wirklich gibt.

---

## 4. Der Planet

### 4.1 Ein kleiner runder Planet

- Du drehst ihn wie einen **Globus** und zoomst vom Weltall bis hinunter zu
  den Baumwipfeln.
- **Natürliche Farben:** grüne Wälder, blaues Meer, graue Felsen, gelbe
  Wüsten, weiße Pole.
- **Zufällig erzeugt** aus einer Startzahl (Seed). Mit derselben Zahl
  entsteht derselbe Planet. Das ist praktisch zum Teilen (siehe 8.6).
- **Planetengröße** wählst du beim Start: klein, mittel oder groß.
- **Kontinente, Inseln und Ozeane** entstehen zufällig. Völker auf getrennten
  Kontinenten treffen sich erst, wenn jemand Boote erfindet.

### 4.2 Klima, Tag und Nacht

- **Klimazonen** wie auf der Erde: Eis an den Polen, Nadelwald und Tundra,
  gemäßigte Wälder und Wiesen, Wüsten, Dschungel am Äquator.
- **Echte Sonne:** Eine Hälfte des Planeten ist immer hell, die andere
  dunkel. Während auf der einen Seite Menschen schlafen, ist auf der anderen
  Seite Mittag.
- **Jahreszeiten** entstehen durch die schräge Achse des Planeten. Auf der
  Nordhälfte ist Sommer, wenn auf der Südhälfte Winter ist.
- **Wetter:** Wolken ziehen um den Planeten. Es gibt Regen, Gewitter, Schnee,
  Nebel und Dürre.

### 4.3 Rohstoffe

Beeren, Fische, Holz, Stein, Lehm, Kupfer, Zinn, Eisen, Kohle und später Öl
und seltene Sci-Fi-Kristalle. Alles, was spätere Epochen brauchen, liegt von
Anfang an auf dem Planeten und wartet darauf, entdeckt zu werden.

### 4.4 Pflanzen und Tiere mit Evolution

- **Ökosystem:**
  - Pflanzen wachsen und verbreiten sich.
  - Pflanzenfresser fressen sie, Raubtiere jagen die Pflanzenfresser.
  - Die Zahl der Tiere schwankt natürlich, wenn Beute oder Futter knapp wird.
- **Die Menschen sind Teil davon:** Jagen sie zu viel, sterben Tierarten aus.
  Später zähmen sie Tiere und züchten Nutztiere.
- **Evolution:**
  - Jede Tierart hat Gene, zum Beispiel für Größe, Schnelligkeit, Fell,
    Farbe, Mut und Futter.
  - Jungtiere ähneln ihren Eltern, mit kleinen zufälligen Veränderungen.
  - Die Umwelt entscheidet, wer überlebt. In kalten Gegenden haben Tiere mit
    dickem Fell mehr Junge, und nach vielen Generationen haben dort alle
    dickes Fell.
  - Leben Gruppen einer Art lange getrennt, zum Beispiel auf zwei Inseln,
    werden sie immer unterschiedlicher. Irgendwann entsteht **eine neue Art**
    mit eigenem Namen. Die Chronik meldet dann: *„Jahr 4.100: Auf der
    Ostinsel ist eine neue Art entstanden, der Langbeinhirsch.“*
  - Auch die Zucht der Menschen verändert Tiere: Aus Wölfen werden Hunde.
- **Die Welt verändert sich durch die Menschen:** Wälder werden gerodet,
  Felder angelegt, Wege werden zu Straßen und Dörfer zu Städten.

---

## 5. Die Menschen

### 5.1 Was jeder Mensch hat

| Bereich | Beispiele |
|---|---|
| **Körper** | Alter, Geschlecht, Aussehen (Hautfarbe, Haarfarbe, Größe, Statur), Kraft, Gesundheit |
| **Charakter** | Neugier, Fleiß, Mut, Freundlichkeit, Aggression, Klugheit, Frömmigkeit, Ehrgeiz (jeweils 0–100) |
| **Bedürfnisse** | Hunger, Durst, Schlaf, Wärme, Sicherheit, Gesellschaft, Liebe, Sinn |
| **Gefühle** | eine Stimmung, die sich aus vielen kleinen Gründen zusammensetzt, z.B. „+15 hat gut gegessen“ oder „−30 Mutter gestorben“ |
| **Fähigkeiten** | Sammeln, Jagen, Bauen, Handwerk, Heilen, Forschen, Kämpfen, Führen, Handeln, Kunst; sie werden durch Übung besser |
| **Gedächtnis** | wichtige Erlebnisse und wie sie sich angefühlt haben |
| **Beziehungen** | Meinung über andere (−100 bis +100) und die Art der Beziehung: Familie, Freund, Partner, Rivale, Feind |
| **Wissen** | was dieser Mensch kann und weiß, z.B. „Feuer machen“ oder „Bronze gießen“ |
| **Glaube** | ob er glaubt, woran, und wie stark |

### 5.2 Wie Menschen Entscheidungen treffen

Jeder Mensch fragt sich ständig: **„Was ist mir gerade am wichtigsten?“**

Jede mögliche Handlung (essen, schlafen, jagen, reden, flirten, erfinden,
streiten …) bekommt Punkte. Die Punkte hängen ab von:

- den **Bedürfnissen**: Wer großen Hunger hat, will vor allem essen.
- dem **Charakter**: Mutige gehen eher jagen, Neugierige untersuchen Neues,
  Freundliche helfen anderen.
- der **Lage**: Ist es Nacht? Ist ein Wolf in der Nähe? Ist Winter?
- **Erinnerungen und Beziehungen**: Wem man nicht traut, dem geht man aus dem
  Weg.
- etwas **Zufall**, damit sich niemand wie eine Maschine verhält.

Dazu hat jeder Mensch **Lebensziele**, die sich im Lauf des Lebens ändern,
zum Beispiel eine Familie gründen, bester Jäger werden, Anführer werden,
etwas Neues erfinden, reich werden oder Rache nehmen.

### 5.3 Reden in Symbolen

Die Figuren haben kein Gesicht, deshalb zeigen **Sprechblasen mit Symbolen**,
was in ihnen vorgeht:

| Blase | Bedeutung |
|---|---|
| 💭 🍖 | denkt: „Ich habe Hunger.“ |
| 💬 🦌❓ | fragt jemanden: „Gehen wir zusammen jagen?“ |
| 💬 ❤️ | flirtet |
| 💬 😠 | streitet |
| 💭 💡 | hat eine Idee |
| 💭 🙏 | betet |
| 💭 😢 | trauert |

In der **Akte** (siehe 8.1) steht zusätzlich in Worten, was passiert ist, z.B.
*„Sprach mit Kel über die Jagd.“*

### 5.4 Gefühle und Gedächtnis

- Die **Stimmung** verändert das Verhalten. Glückliche Menschen arbeiten
  besser und sind netter. Traurige ziehen sich zurück. Wütende fangen Streit an.
- Das **Gedächtnis** speichert wichtige Erlebnisse. Kleine Dinge verblassen,
  große bleiben ein Leben lang.
- Erinnerungen formen Beziehungen:
  - *„Bor hat mir im Winter Essen gegeben“* führt zu Freundschaft.
  - *„Bor hat meinen Bruder erschlagen“* führt zu Hass und vielleicht zu einem
    Racheplan.
- **Fehden über Generationen:** Kinder übernehmen einen Teil der Meinungen
  ihrer Eltern. So kann ein alter Streit hundert Jahre später noch einen Krieg
  auslösen.
- **Normales Drama:** Freundschaft, Liebe und Streit wie im echten Leben. Ab
  und zu passiert etwas Großes, etwa Eifersucht, ein Verrat oder ein
  Racheschwur. Das ist aber die Ausnahme, nicht der Alltag.

### 5.5 Liebe, Familie und Vererbung

- **Anziehung** entsteht aus Sympathie, passendem Charakter, Aussehen und ein
  bisschen Zufall. Daraus wird Flirt, dann Partnerschaft. Sobald die Kultur sie
  erfindet, gibt es auch Hochzeiten.
- **Kinder** erben von ihren Eltern:
  - **Aussehen:** Es gibt dominante und rezessive Gene. Rote Haare können
    deshalb eine Generation überspringen und beim Enkel wieder auftauchen.
  - **Charakter-Anlagen:** ungefähr der Durchschnitt der Eltern, plus Zufall.
  - **Talente:** wie schnell jemand etwas lernt, teilweise vererbt.
- **Erziehung:** Kinder lernen Wissen, Werte und Glauben von ihren Eltern und
  der Gemeinschaft.
- **Partnerwahl:** Menschen wählen keine nahen Verwandten als Partner.
  - Deshalb startet das Spiel standardmäßig mit **6 nicht verwandten
    Menschen**.
  - Startest du mit nur 2, finden ihre Kinder später keine Partner. Das Spiel
    weist dich dann darauf hin, dass du neue Menschen erschaffen kannst.
- **Stammbaum:** Er wird über alle Generationen hinweg gespeichert.

### 5.6 Lebensphasen, Gesundheit und Tod

- **Lebensphasen:**
  1. Baby
  2. Kind: spielt und lernt
  3. Jugendlicher
  4. Erwachsener
  5. Alter Mensch: weise, aber langsamer
- **Was Menschen schadet:**
  - Krankheiten; in dichten Siedlungen auch Seuchen
  - Verletzungen bei Jagd und Kampf
  - Hunger und Kälte
- **Leichtes Überleben:** Die Natur ist großzügig und Krankheiten verlaufen
  meist mild. Ohne dich stirbt eine Gruppe nur selten aus. Deine Kräfte setzt
  du ein, weil du **willst**, nicht weil du **musst**. Gefährlich wird es vor
  allem durch Kriege und durch dich selbst.
- **Die Lebenserwartung steigt mit dem Wissen:** Heilkräuter, dann Medizin,
  dann moderne Medizin, dann Sci-Fi-Medizin. In der Steinzeit werden Menschen
  etwa 30–40 Jahre alt, in der Moderne etwa 80, und in der Zukunft vielleicht
  noch viel älter.
- **Nach dem Tod:**
  - Angehörige trauern.
  - Später entstehen Begräbnisrituale.
  - Verstorbene bleiben im Archiv. Du kannst ihre Lebensgeschichte und ihren
    Platz im Stammbaum jederzeit ansehen.

### 5.7 Arbeit nach Bedarf und Talent

- Die Gruppe merkt, was fehlt: Das Essen wird knapp, es gibt keine
  Unterkunft, der Winter kommt.
- Jeder Mensch wählt seine Arbeit nach drei Dingen: **Bedarf der Gruppe ×
  eigenes Talent × Charakter.**
  - Mutige gehen jagen.
  - Neugierige forschen.
  - Freundliche kümmern sich um Kranke.
- **Berufe entstehen erst mit dem Wissen:**

| Zeit | Typische Arbeit |
|---|---|
| Steinzeit | Jeder macht fast alles, mit leichter Spezialisierung (Sammler, Jäger, Feuerhüter) |
| Jungsteinzeit | Bauer, Hirte, Töpfer, Hüttenbauer |
| Bronze- und Eisenzeit | Schmied, Händler, Priester, Krieger, Schreiber |
| Mittelalter bis Neuzeit | Handwerker, Kaufmann, Soldat, Gelehrter, Seefahrer |
| Industrie und Moderne | Fabrikarbeiter, Ingenieur, Arzt, Lehrer, Wissenschaftler |
| Sci-Fi-Zukunft | Klon-Züchter, Roboter-Mechaniker, Zeitreise-Forscher, Wolkenstadt-Pilot … |

---

## 6. Wie sich die Welt von selbst entwickelt

### 6.1 Erfindungen

**Es gibt keine feste Reihenfolge.** Im Hintergrund gibt es ein
**Wissensnetz**: Es legt fest, welche Erfindungen möglich sind und was sie
voraussetzen. *Ob* und *wann* jemand etwas erfindet, hängt von fünf Dingen ab:

| Faktor | Beispiel |
|---|---|
| **Voraussetzungen** | Bronze setzt voraus, dass man Feuer machen kann und Erz kennt. |
| **Gelegenheit** | Kupfererz liegt in der Nähe, oder ein Blitz schlägt ein. |
| **Not** | Wer friert, kommt eher auf die Idee, Kleidung zu machen. |
| **Person** | Kluge, neugierige und erfahrene Menschen erfinden mehr. |
| **Zufall** | Manchmal klappt es sofort, manchmal dauert es Generationen. |

**Wissen kann verloren gehen.**

- Wissen steckt in den Köpfen der Menschen und wird weitergegeben: von Eltern
  an Kinder und vom Meister an den Lehrling.
- Stirbt der letzte Mensch, der etwas weiß, ist das Wissen verloren.
- Erst mit der **Schrift** wird Wissen dauerhaft gespeichert, in Schriftrollen
  und Bibliotheken. Auch die können allerdings abbrennen.

**Völker entwickeln sich unterschiedlich.** Ein Volk kann schon Eisen
schmieden, während das Nachbarvolk noch Steinwerkzeuge benutzt.

**Deine Rolle:** Mit *Gedanken flüstern* kannst du einem Menschen eine Idee
eingeben. Damit die Geschichte glaubwürdig bleibt, geht das nur für den
**nächsten Schritt**: Wer kein Metall kennt, kann kein Schwert erfinden. Für
reines Herumprobieren gibt es einen **Sandbox-Schalter „Wissen schenken“**, der
diese Regel aufhebt.

### 6.2 Epochen: realistisch langsam

Die Entwicklung ist **realistisch langsam**. Die Steinzeit dauert Tausende
Jahre, und der Fortschritt wird wie in der echten Geschichte immer
**schneller**. Die Epoche wird für **jedes Volk einzeln** bestimmt, und zwar
durch seine wichtigsten Erfindungen.

| Epoche | Beispiel-Erfindungen | Ungefähre Dauer (Richtwert) |
|---|---|---|
| **Altsteinzeit** | Faustkeil, Feuer, Speer, Fellkleidung, Sprache und Gesang | 3.000–5.000 Jahre |
| **Jungsteinzeit** | Ackerbau, Viehzucht, Töpferei, Lehmhütten | 1.500–3.000 Jahre |
| **Bronzezeit** | Kupfer und Bronze, Rad, Schrift, erste Städte | ca. 1.000 Jahre |
| **Eisenzeit / Antike** | Eisen, Münzgeld, Gesetze, Straßen, Philosophie | ca. 800 Jahre |
| **Mittelalter** | Mühlen, Burgen, Zünfte, Seefahrt | ca. 700 Jahre |
| **Neuzeit** | Buchdruck, Schießpulver, Wissenschaft, Entdeckungsreisen | ca. 300 Jahre |
| **Industrie** | Dampfmaschine, Fabriken, Eisenbahn, Elektrizität | ca. 150 Jahre |
| **Moderne** | Auto, Flugzeug, moderne Medizin, Computer | ca. 100 Jahre |
| **Sci-Fi-Zukunft** | Roboter, KI-Wesen, Cyborgs, Klone, fliegende Städte, Wettermaschinen, Zeitmaschinen | offen |

Insgesamt dauert der Weg von der Steinzeit in die Zukunft also etwa
**8.000–12.000 Spieljahre**. Damit das nicht langweilig wird, gibt es
**Zeitsprung** und **Film-Modus** (siehe Kapitel 9 und 10).

### 6.3 Die verrückte Sci-Fi-Zukunft

In der Zukunft ist (fast) alles möglich. Ein paar Ideen:

- **Roboter und KI-Wesen:** Neue „Menschen“ aus Metall, mit eigenem
  Charakter, eigenen Bedürfnissen (Energie statt Essen) und eigenen Rechten,
  um die gestritten wird.
- **Cyborgs:** Menschen bauen sich Technik ein und werden stärker, klüger
  oder älter.
- **Klone:** Sie haben dieselben Gene, entwickeln aber durch ein anderes
  Leben einen anderen Charakter.
- **Fliegende Städte** über Ozeanen und Wüsten.
- **Wettermaschinen und Terraforming:** Die Menschen bekommen selbst
  gottähnliche Kräfte. Glauben sie dann noch an dich?
- **Zeitmaschinen:** Zeitreisende tauchen in früheren Epochen auf und
  hinterlassen rätselhafte Spuren in der Chronik.

### 6.4 Wirtschaft

Die Wirtschaft entwickelt sich in Stufen:

1. **Teilen:** Die Gruppe hat einen gemeinsamen Vorrat.
2. **Tauschen:** Fell gegen Fisch, zwischen Menschen und zwischen Stämmen.
3. **Geld:** Es entsteht durch Metallverarbeitung und Handel, zuerst als
   Muscheln oder Metallstücke, später als Münzen.
4. **Märkte und Arbeit gegen Lohn:** Preise entstehen aus Angebot und
   Nachfrage.
5. **Moderne Wirtschaft:** Banken, Fabriken, Handel über Kontinente.
6. **Zukunft:** Roboter machen die Arbeit. Und dann?

Was daraus folgt:

- **Eigentum** entsteht: Felder, Häuser und Vorräte gehören jemandem. Durch
  Erbe gibt es **reiche und arme Familien**.
- **Ungleichheit hat Folgen:** Neid, Diebstahl und Aufstände, aber auch
  Fleiß und Aufstieg.

### 6.5 Gemeinschaft, Völker und Politik

- **Größere Gruppen entstehen nach und nach:** Familie, Sippe, Stamm,
  Häuptlingstum, Königreich oder Stadtstaat, und zuletzt Staaten.
- **Anführer:** Am Anfang führt, wer das meiste Ansehen hat, also stark, klug
  oder beliebt ist. Später gibt es Erbfolge, Wahlen und Putsche.
- **Regierungsformen** ergeben sich aus der Lage und der Kultur:
  - **Häuptling** oder **Ältestenrat** in kleinen Gruppen
  - **Monarchie**, wenn ein Herrscher sein Amt vererbt
  - **Priesterherrschaft**, wenn der Glaube sehr stark ist
  - **Republik oder Demokratie**, wenn es Schrift, Wohlstand und
    mitbestimmungswillige Bürger gibt
  - **Diktatur** nach Kriegen oder Krisen
  - in der Zukunft vielleicht eine **KI-Regierung**
- **Gesetze und Strafen** entstehen, sobald es Anführer und später die Schrift
  gibt.
- **Abspaltung:** Wird eine Gruppe zu groß oder gibt es Streit, zieht ein Teil
  weg. So entsteht ein **neues Volk** mit eigenem Namen, eigener Kultur und
  eigenem Glauben.
- **Kultur:** Jedes Volk hat Werte, zum Beispiel friedlich oder kriegerisch,
  fromm oder weltlich, offen oder verschlossen. Diese Werte entstehen aus dem
  Charakter seiner Menschen und der gemeinsamen Geschichte.
- **Diplomatie:** Handel, Bündnisse, Heirat zwischen Herrscherfamilien und
  Krieg.

### 6.6 Konflikte, Verbrechen und Krieg

Konflikte werden in Stufen größer:

1. Streit
2. Schlägerei
3. Diebstahl
4. Mord (selten; aus Hass, Eifersucht, Rache oder Verzweiflung)
5. Fehde zwischen Familien
6. Krieg zwischen Völkern

- **Kriegsgründe:** Hunger und Land, Rohstoffe, Rache, Religion, ehrgeizige
  Herrscher.
- **Folgen von Kriegen:**
  - Tote und Trauer
  - Hass über Generationen
  - Eroberung und Flüchtlinge
  - aber auch Bündnisse und neue Erfindungen wie Mauern und Waffen
- **Darstellung:** stilisiert und minimalistisch, nicht blutig.

### 6.7 Glaube und Religion

Du bist unsichtbar, also müssen die Menschen **dich selbst entdecken**. Das
läuft in vier Stufen ab:

1. **Unwissend:** Für die Menschen ist die Natur einfach die Natur.
2. **Staunen:** Erleben sie etwas Unerklärliches, bekommen sie **Ehrfurcht**.
   Das kann ein Wunder sein, eine plötzliche Heilung oder ein Blitz aus klarem
   Himmel. Fromme Menschen suchen nach einer Erklärung.
3. **Mythen und Schamanen:** Ein frommer, angesehener Mensch wird Schamane
   oder Prophet. Es entstehen Rituale wie Tänze und Opfer. Der Ort eines
   Wunders wird ein **heiliger Ort**.
4. **Religion:** Sie hat einen Namen, Gebote, Priester und Tempel.

**Wie die Religion wird, hängt von dir ab:**

| Dein Verhalten | Was die Menschen glauben |
|---|---|
| viele Segen und Heilungen | ein gütiger Gott |
| viele Katastrophen | ein zorniger Gott, den man besänftigen muss |
| beides gemischt | ein launischer Gott |

**Gebete:**

- Gläubige beten zu dir. Ihre Gebete erscheinen als 🙏-Symbol über ihren
  Köpfen, zum Beispiel 🙏🌧️ für *„Bitte lass es regnen“*.
- Erhörst du ein Gebet, wird der Glaube stärker. Ignorierst du Gebete,
  kommen Zweifel.

**Glaube verändert das Verhalten:**

- Er spendet Trost bei Trauer.
- Er stärkt den Zusammenhalt.
- Seine Gebote führen zu weniger Verbrechen.
- Er führt aber auch zu Streit zwischen Religionen, zu Spaltungen und zu
  Glaubenskriegen.
- In späteren Epochen kommen Zweifel und Unglaube dazu, und in der Zukunft
  vielleicht Menschen, die mit Maschinen nach dir suchen.

---

## 7. Deine Kräfte als Gott

⭐ **Das ist der wichtigste Teil des Spiels.** Jede Kraft soll sich mächtig
anfühlen: mit sichtbarer Wirkung, Geräuschen, Kamerawackeln und echten Folgen
für die Welt.

- Du bist **unsichtbar**. Man sieht nur die Kamera, einen Zeiger und die
  Wirkung deiner Kräfte.
- Deine Kräfte sind **unbegrenzt** und kosten nichts.
- Alles, was du tust, hat aber **Folgen**, und die Menschen sehen es.
- Ging etwas zu weit, kannst du **zurückspulen** (siehe 9).

### 🌩️ Natur: gewaltig

Katastrophen sind **gewaltig**. Sie können ganze Völker auslöschen und den
Planeten dauerhaft verändern.

| Kraft | Wirkung |
|---|---|
| **Regen / Dürre / Sonne** | Ernten, Flüsse, Waldbrände |
| **Blitz** | gezielt auf einen Punkt; kann Feuer entfachen oder ein Wunder sein |
| **Supersturm** | zieht über das Land und zerstört Hütten und Wälder |
| **Erdbeben** | spaltet den Boden, Häuser stürzen ein, neue Schluchten entstehen |
| **Vulkan** | Lava zerstört alles in der Nähe. Die Asche verdunkelt den Himmel, und ein „vulkanischer Winter“ lässt Ernten weltweit ausfallen. |
| **Flut / Tsunami** | versenkt ganze Küsten |
| **Meteorit** | Einschlag mit Krater, Druckwelle und Staubwolke; in groß ein Weltuntergang |
| **Eiszeit / Hitzezeit** | verändert das Klima auf dem ganzen Planeten für Jahrhunderte |
| **Feuer** | legen und löschen |
| **Landschaft formen** | Berge heben, Täler senken, Flüsse ziehen, Inseln erschaffen oder versenken |
| **Wälder wachsen lassen** | ganze Wälder auf einmal |

### ✨ Segen und Wunder

- Reiche Ernte und volle Jagdgründe
- Heilen: einen einzelnen Menschen, oder eine Seuche beenden
- Glück: Einem Menschen gelingt eine Zeit lang alles.
- Fruchtbarkeit: Ein Paar bekommt ein Kind.
- Himmelszeichen: Regenbogen, Lichtsäule, Komet; nur zum Staunen
- Wiederbeleben eines gerade Verstorbenen: das größte aller Wunder

### 💭 Gedanken flüstern

- **Idee:** eine Erfindung für den nächsten Schritt (siehe 6.1)
- **Gefühl:** Liebe zu einer bestimmten Person, Mut, Angst, Zorn, Vergebung,
  Trost
- **Absicht:** auswandern, Frieden schließen, Anführer werden, Lehrer werden

Ein Flüstern ist ein **starker Anstoß, aber kein Befehl**. Wie stark es wirkt,
hängt vom Charakter ab: Ein sturer Krieger wird nur schwer friedlich. So
behalten die Menschen ihren freien Willen. Das entspricht deiner Wahl
„ausgewogen“.

### ⚖️ Leben und Tod

- **Menschen erschaffen:** Du wählst nur den Ort und wie viele. Wer sie sind,
  entscheidet der Zufall: Name, Aussehen und Charakter.
- **Tiere aussetzen:** eine bestehende Art oder eine zufällige neue Art, die
  sich dann selbst weiterentwickelt
- **Einen Menschen sterben lassen:** friedlich im Schlaf oder durch einen
  Blitz
- **Eine Seuche schicken**, bei Menschen oder bei Tieren
- **Unsichtbare Hand:** Ein Mensch schwebt wie von Geisterhand an einen
  anderen Ort.

### Sichtbar oder unsichtbar?

Das ist wichtig für den Glauben:

| Wirkt wie Natur oder Zufall | Wirkt wie ein Wunder |
|---|---|
| Gedanken flüstern | Blitz aus klarem Himmel |
| normales Wetter | Wiederbeleben, plötzliche Heilung |
| langsames Wachstum | schwebende Menschen, Himmelszeichen |
| | Regen genau im Moment eines Gebets |

Du entscheidest also selbst, ob du **im Verborgenen lenkst** oder dich
**zeigst**.

---

## 8. Beobachten: Was du sehen kannst

Alle Texte klingen **wie ein Geschichtsbuch**: klar und sachlich.

### 8.1 📖 Lebensgeschichte (Akte)

Klickst du einen Menschen an, öffnet sich seine Akte:

- Figur, Name, Alter, Volk, Beruf
- Charakter als Balken, z.B. Neugier ████████░░
- Bedürfnisse und Stimmung mit Gründen, z.B. „+10 hat gut gegessen“
- Was er gerade tut und warum: *„Hat Hunger. Geht zum Beerenstrauch am Fluss.“*
- Beziehungen: Familie, Freunde, Feinde
- Wissen und Glaube
- **Lebenslauf**, der sich selbst schreibt: *„Geboren im Frühling des Jahres
  12. Lernte von der Mutter das Feuermachen. Partnerschaft mit Kel ab dem 17.
  Lebensjahr. Überlebte die Große Flut von Jahr 40. Starb mit 43 Jahren an
  Fieber.“*
- Knöpfe: **Folgen**, **Ich-Perspektive**, **Flüstern**, **Segnen** …

### 8.2 📜 Weltchronik

Ein Geschichtsbuch, das sich selbst schreibt:

> *Jahr 19 – Mina entdeckt das Feuer nach einem Blitzeinschlag in eine Eiche.*
> *Jahr 160 – Die Nachkommen von Tok spalten sich ab und gründen den Stamm der Tokar.*
> *Jahr 230 – Nach einem Regen während einer Dürre entsteht der Glaube an den Himmelsgeist.*

- Die Epochen sind die **Kapitel**.
- Wichtige Ereignisse sind hervorgehoben.
- Du kannst nach Volk, Person oder Art des Ereignisses filtern, z.B.
  Erfindungen, Kriege, Religion oder Tiere.

### 8.3 📊 Statistiken

Diagramme über die Zeit, auch zum Vergleichen der Völker:

- Bevölkerung, Geburten und Todesfälle
- Glück und Lebenserwartung
- Wissen: Anzahl der Erfindungen
- Reichtum und Ungleichheit
- Glaube: Anteil der Gläubigen und Anzahl der Religionen
- Konflikte: Verbrechen und Kriege
- Tierwelt: Anzahl der Arten, ausgestorbene und neue Arten

### 8.4 🌳 Stammbaum

- Er ist interaktiv und reicht über alle Generationen.
- Vererbung wird sichtbar, z.B. *„rote Haare von Urgroßmutter Ara“*.
- Mit einem Klick auf einen Vorfahren siehst du seine Lebensgeschichte.

### 8.5 🔔 Benachrichtigungen

- Wichtige Momente erscheinen als Meldung, z.B. *„Neue Erfindung“*,
  *„Kriegsbeginn“* oder *„Neue Tierart“*.
- Auf Wunsch hält das Spiel dabei automatisch an (**Auto-Pause**).

### 8.6 🔗 Welt teilen

- **Spielstand-Datei:** Du schickst deinen ganzen Planeten mit allen Menschen
  und seiner ganzen Geschichte an Freunde, und sie spielen dort weiter.
- **Welt-Code:** ein kurzer Code wie `ENIS-7K3P-Q9`. Damit startet jemand
  anderes auf **demselben Start-Planeten**, und die Geschichte verläuft dort
  ganz anders.

---

## 9. Die Zeit

### 9.1 Geschwindigkeit

- **Steuerung:** ⏸ Pause · ▶ 1× · ▶▶ 10× · ▶▶▶ 100× · ⏩ 1000×
- **Kalender (Richtwert):** 1 Jahr hat 4 Jahreszeiten zu je 10 Tagen.

| Geschwindigkeit | Ein Tag dauert | Ein Jahr dauert | Gut für |
|---|---|---|---|
| 1× | ca. 1 Minute | ca. 40 Minuten | den Alltag einzelner Menschen beobachten |
| 10× | ca. 6 Sekunden | ca. 4 Minuten | Jahreszeiten, Ernten, Kinder aufwachsen sehen |
| 100× | ca. 0,6 Sekunden | ca. 24 Sekunden | Generationen |
| 1000× | – | ca. 2,4 Sekunden | Jahrhunderte (1000 Jahre in ca. 40 Minuten) |

- **Zeitraffer-Modus ab 100×:** Die Menschen laufen nicht mehr Schritt für
  Schritt herum. Die Simulation rechnet in größeren Schritten, und du siehst,
  wie Dörfer wachsen und Wälder verschwinden.

### 9.2 ⏭️ Zeitsprung

Weil die Entwicklung realistisch langsam ist, kannst du mit einem Klick
**+10, +100 oder +1000 Jahre** überspringen.

- Die Simulation rechnet dann so schnell wie möglich, ohne Grafik.
  **Ziel:** 1000 Jahre in etwa einer Minute.
- Danach bekommst du eine **Zusammenfassung**: *„Was in 1000 Jahren geschah“*,
  mit den wichtigsten Ereignissen aus der Chronik.
- Optional hält der Sprung automatisch an, wenn etwas Großes passiert, z.B.
  ein Krieg oder eine neue Religion.

### 9.3 ⏪ Zurückspulen

- Das Spiel legt automatisch **Rückspulpunkte** an: alle 10 Spieljahre und
  **vor jeder Katastrophe**, die du auslöst.
- War ein Vulkan zu viel? Dann wählst du einen Rückspulpunkt und die Welt
  ist wieder wie vorher.
- Ab diesem Punkt geht die Geschichte neu weiter, und sie kann ganz anders
  verlaufen.

### 9.4 Auto-Pause

Bei wichtigen Ereignissen hält das Spiel an. Du stellst ein, bei welchen.

---

## 10. Bildschirm, Kamera & Steuerung

### 10.1 Bildschirm

```
┌──────────────────────────────────────────────────────────────────┐
│ Jahr 3.614 · Sommer (Nord) · Jungsteinzeit  👥 38  ⏪ ⏸ ▶ ⏩ ⏭️    │
├────┬───────────────────────────────────────────────┬─────────────┤
│ 🌩️ │                .-~~~~~~-.                     │  Ara (34)   │
│ ✨ │             .'  ~  ^^   ~ '.                   │  Sammlerin  │
│ 💭 │            /  ~~   🌲🌲  ~   \                  │  💭 🍖       │
│ ⚖️ │           |   ~  🏕️  ~~   ~  |   Planet        │  Neugier ██ │
│    │            \  ~~   ~~   ~   /    (drehen,      │  …          │
│ 📜 │             '.  ~    ~   .'      zoomen,       │ [Folgen]    │
│ 📊 │                '-~~~~~~-'        anklicken)    │ [Ich-Sicht] │
│ 🌳 │                                               │ [Flüstern]  │
├────┴───────────────────────────────────────────────┴─────────────┤
│ 📜 Jahr 3.614: Kel erfindet die Töpferei · Jahr 3.613: Tok stirbt │
└──────────────────────────────────────────────────────────────────┘
```

- **Oben:** Jahr, Jahreszeit, Epoche, Bevölkerung, Zeitsteuerung mit
  Zurückspulen und Zeitsprung.
- **Links:** Götterkräfte (Natur, Segen, Flüstern, Leben & Tod), darunter
  Chronik, Statistiken und Stammbaum.
- **Rechts:** Infos zu dem, was du angeklickt hast (Mensch, Tier, Volk, Ort).
- **Unten:** Ereignis-Ticker.
- **Sprache** umschaltbar: Deutsch / English.

### 10.2 Kamera-Ansichten

| Ansicht | Was du siehst |
|---|---|
| 🌍 **Gott-Ansicht** | Du drehst den Planeten frei und zoomst vom Weltall bis zu einem einzelnen Dorf. |
| 🎥 **Folgen-Modus** | Die Kamera begleitet einen Menschen (oder ein Tier) durch seinen Alltag, wie in einer Doku. |
| 👁️ **Ich-Perspektive** | Du siehst durch die Augen eines Menschen. Er läuft selbst, du bewegst nur den Blick. Sein freier Wille bleibt. |
| 🎬 **Film-Modus** | Die Kamera fliegt automatisch zu spannenden Ereignissen: einer Geburt, einer Erfindung, einem Krieg, einem Vulkan. Zum Zurücklehnen und Zuschauen. |

### 10.3 Steuerung für alle Geräte gleich gut

| Aktion | PC (Maus und Tastatur) | Handy und Tablet (Touch) |
|---|---|---|
| Planet drehen | linke Maustaste ziehen | mit einem Finger wischen |
| Zoomen | Mausrad | mit zwei Fingern auseinander oder zusammen ziehen |
| Kamera neigen | rechte Maustaste ziehen | mit zwei Fingern drehen |
| Auswählen | Klick | Tippen |
| Kraft einsetzen | Kraft wählen, dann auf den Ort klicken | Kraft wählen, dann auf den Ort tippen |
| Schnellzugriff | Tasten 1–9 für Kräfte, Leertaste für Pause | große Knöpfe am Rand |

Auf kleinen Bildschirmen werden die Seitenleisten zu **Fenstern, die von
unten hochfahren**. Alle Knöpfe sind groß genug für Finger.

---

## 11. Grafik & Ton

### 11.1 Grafik: natürlich und minimal

- **Natürliche Farben** und weiches Sonnenlicht, glaubwürdig und ruhig. Das
  Drama kommt von den Katastrophen, nicht von grellen Farben.
- **Low-Poly:** Alles besteht aus wenigen flachen Flächen. Das läuft flüssig
  im Browser und auf dem Handy.
- **Menschen als minimale Figuren:**
  - Sie sehen aus wie Spielfiguren: ein Körper und ein Kopf, **ohne Gesicht**.
  - Die Gene bestimmen Hautfarbe, Haarfarbe (als Haarschopf), Größe und
    Statur. So sieht man die Vererbung in Familien.
  - Kleidung ist eine einfache Form oder ein Farbband, je nach Epoche und
    Beruf.
  - Gefühle zeigen die Symbol-Blasen (siehe 5.3).
- **Tiere** sind ebenso einfach. Ihre Gene sieht man aber an Größe, Farbe,
  Fell und Beinlänge, damit die Evolution sichtbar wird.
- **Im Code erzeugt:** Figuren, Häuser und Bäume werden aus einfachen Formen
  zusammengesetzt. So entstehen Varianten für jede Epoche, ohne dass wir
  Hunderte Modelle brauchen.
- **Gebäude im Wandel:** Lager unter Bäumen, dann Zelte, Lehmhütten,
  Steinhäuser, Burgen, Fabriken, Hochhäuser und zuletzt fliegende Städte.
- **Licht:**
  - Die echte Sonne beleuchtet eine Hälfte des Planeten, auf der anderen
    funkeln die Sterne.
  - Nachts leuchten Lagerfeuer, später die Lichter der Städte.
- **Katastrophen-Effekte:**
  - Lava, Aschewolken, Flutwellen und Meteoriten mit Feuerschweif
  - Kamerawackeln und Staub
  - Sie sind das Spektakulärste im ganzen Spiel.

### 11.2 Ton

- **Naturgeräusche, die zum Ort passen:** Wind, Vögel, Meeresrauschen,
  Regen, knisterndes Lagerfeuer. Nah an einem Dorf hört man Stimmengemurmel
  und Arbeit.
- **Kräfte klingen mächtig:** Donner, Grollen beim Erdbeben, das Brüllen
  eines Vulkans.
- **Ruhige Musik, die sich mit der Epoche ändert:**
  - Steinzeit: Trommeln und Flöten
  - Mittelalter: Saiteninstrumente
  - Moderne: Klavier
  - Zukunft: Synthesizer
- **Lautstärke** lässt sich für Musik und Geräusche getrennt einstellen.

---

## 12. Technik (für die Entwicklung)

| Bereich | Wahl | Warum |
|---|---|---|
| Sprache | TypeScript | weniger Fehler bei einer großen Simulation |
| Build | Vite | schneller Start, einfache Veröffentlichung |
| 3D | Three.js (WebGL) | verbreitet, läuft in jedem modernen Browser |
| Planet | Kugel aus Dreiecken (Ikosaeder) + 3D-Rauschen für das Gelände; nah fein, weit grob | runder Planet, flüssig auch auf dem Handy |
| Wege auf der Kugel | Netz aus Feldern auf der Planetenoberfläche, Wegsuche mit A* | Menschen und Tiere finden ihren Weg um den Planeten |
| Oberfläche | HTML/CSS-Overlay mit Preact | klein und schnell, gut für Fenster und Listen |
| Steuerung | Pointer Events (Maus und Touch gemeinsam) | ein Code für alle Geräte |
| Simulation | eigener Kern in einem **Web Worker** | rechnet getrennt von der Grafik, damit das Bild nicht ruckelt |
| Zufall | deterministisch mit Seed | gleiche Startzahl ergibt gleiche Geschichte; Grundlage für Welt-Code und Zurückspulen |
| Mehrsprachig | alle Texte in Sprachdateien (`de`, `en`) von Anfang an | kein Umbau später nötig |
| Speichern | Autosave in IndexedDB | Spielstand bleibt erhalten |
| Zurückspulen | komprimierte Rückspulpunkte (alle 10 Jahre und vor Katastrophen) | schnell zurück, ohne den Speicher zu sprengen |
| Zeitsprung | der Worker rechnet ohne Grafik im statistischen Modus | 1000 Jahre in etwa einer Minute |
| Teilen | Spielstand-Datei (`.enis`) + kurzer Welt-Code (Seed) | Planeten an Freunde schicken |
| Ton | Web Audio API, freie Klänge (CC0) | Geräusche nach Ort und Entfernung |
| Diagramme | uPlot | sehr klein und schnell |
| Tests | Vitest + Playwright | Simulation testen, Screenshots im Browser prüfen |
| Veröffentlichung | z.B. GitHub Pages | das Spiel als Link öffnen |

### Aufbau

```
┌─────────────────────────┐   Zustand (kompakt)  ┌──────────────────────────┐
│  Simulation (Worker)    │ ───────────────────► │  Darstellung (Three.js)  │
│  · Planet, Klima        │                      │  · Planet, Wetter        │
│  · Pflanzen, Tiere, Evo │ ◄─────────────────── │  · Figuren, Gebäude      │
│  · Menschen, Entscheid. │   Götterkräfte,      │  · Katastrophen-Effekte  │
│  · Wissen, Wirtschaft   │   Zeitsteuerung      ├──────────────────────────┤
│  · Völker, Glaube       │                      │  Oberfläche (Preact)     │
│  · Chronik, Rückspulen  │                      │  · Akte, Chronik, Stats  │
└─────────────────────────┘                      └──────────────────────────┘
```

### Simulation in Stufen (damit es auch mit vielen Menschen flüssig bleibt)

| Stufe | Für wen | Wie genau |
|---|---|---|
| **Detail** | Menschen und Tiere in Kameranähe | jeder Schritt, Gespräche, Animation |
| **Normal** | Menschen außerhalb der Sicht | Entscheidungen in größeren Zeitschritten, keine Animation |
| **Herden** | Tiere außerhalb der Sicht | als Herden gerechnet; Gene und Evolution pro Herde |
| **Statistisch** | Hintergrund-Bevölkerung großer Städte (ab Moderne) und Zeitsprung | als Gruppen gerechnet |

Wichtige Personen bleiben **immer** einzelne Menschen: Herrscher, Erfinder,
Propheten und alle, die du angeklickt oder markiert hast.
**Ziel:** flüssig bis etwa 2.000 einzeln simulierte Menschen. Größere Städte
werden darüber hinaus statistisch gerechnet.

### Datenmodell (Entwurf)

```ts
interface Mensch {
  id: number;
  name: string;
  geboren: number;               // Spieltag
  geschlecht: 'w' | 'm';
  eltern: [number, number] | null;
  gene: Gene;                    // Aussehen + Anlagen (dominant/rezessiv)
  charakter: Record<Eigenschaft, number>;   // 0–100
  beduerfnisse: Record<Beduerfnis, number>; // 0–100
  stimmung: Stimmungsgrund[];    // z.B. { text: 'hat gut gegessen', wert: +10, bis: Tag }
  faehigkeiten: Record<Faehigkeit, number>;
  gedaechtnis: Erinnerung[];     // wichtige Erlebnisse mit Gefühlswert
  beziehungen: Map<number, Beziehung>;      // Meinung −100..+100, Art
  wissen: Set<ErfindungId>;
  glaube: { religion: number | null; staerke: number };
  volk: number;
  ziele: Lebensziel[];
  aktion: Aktion | null;         // was er gerade tut
  ort: FeldId;                   // Feld auf der Planetenoberfläche
}

interface Tierart {
  id: number;
  name: string;                  // z.B. „Langbeinhirsch“ (automatisch erzeugt)
  vorfahr: number | null;        // aus welcher Art sie entstanden ist
  ernaehrung: 'pflanzen' | 'fleisch' | 'alles';
}

interface Herde {
  art: number;
  anzahl: number;
  gene: TierGene;                // Größe, Tempo, Fell, Farbe, Mut …
  ort: FeldId;
}
```

- Erfindungen, Berufe, Gebäude, Epochen und Texte werden als **Daten**
  beschrieben, nicht fest im Code. Eine neue Erfindung ist dann nur ein neuer
  Eintrag.
- Ein Simulationsschritt entspricht 10 Spielminuten.

---

## 13. Fahrplan

Weil dir **Götterkräfte am wichtigsten** sind, kommen sie früh: schon im
zweiten Meilenstein. Jeder Meilenstein endet mit einer **spielbaren Version
als Link**. Du testest sie, und ich stelle dir wieder Klick-Fragen für die
nächsten Schritte.

| # | Meilenstein | Was du danach sehen und tun kannst |
|---|---|---|
| ✅ 0 | **Konzept** | dieses Dokument |
| ✅ 1 | **Erster Planet** | ein runder Planet mit Ozeanen, Kontinenten, Bergen und Klimazonen; echte Sonne mit Tag und Nacht; Gott-Kamera für Maus und Touch; Zeitsteuerung; Deutsch und Englisch |
| ✅ 2 | **Zorn & Natur** ⭐ | die Naturkräfte: Blitz, Regen, Dürre, Sturm, Erdbeben, Vulkan, Flut, Meteorit, Eiszeit, Landschaft formen; spektakuläre Effekte, erste Geräusche, **Zurückspulen** |
| ✅ 3 | **Erstes Leben** | Pflanzen und Tiere im Ökosystem; 6 Menschen mit Hunger, Durst und Schlaf; Symbol-Blasen und Akte; Segen und Leben & Tod; Folgen-Modus. Glück, Fruchtbarkeit und Himmelszeichen folgen mit Meilenstein 4 |
| ✅ 4 | **Leben & Liebe** | Charakter, Gefühle, Beziehungen, Altern und Tod, Kinder mit Vererbung, Stammbaum, Weltchronik, Gedanken flüstern; dazu Glück, Fruchtbarkeit und Himmelszeichen. Ideen und „Lehrer werden“ folgen mit Meilenstein 5 |
| ✅ 5 | **Wissen & lange Zeiten** | Erfindungen entstehen von selbst (11 aus der Steinzeit), Wissen wird weitergegeben und kann verloren gehen, Arbeit nach Bedarf, Hütten und Feuerstellen; **Zeitsprung**; Evolution der Tiere mit neuen Arten; Flüstern von Ideen und „Lehrer werden“ |
| ✅ 6 | **Glaube** | die Menschen entdecken dich, Schamanen (Stimme der Geister), Religionen je nach deinen Taten, Gebete, die du erhören kannst, heilige Orte mit Steinkreisen, dein Bild bei den Menschen |
| ✅ 7 | **Stämme & Konflikte** | Völker mit Namen, Farbe, Kultur und Häuptling; Abspaltung; Begegnung und Tauschhandel; Beziehungen zwischen Völkern; Diebstahl, Mord und Verbannung; Kriege mit Schlachten, Unterwerfung und Frieden |
| ✅ 8 | **Zivilisation** | Ackerbau, Viehzucht, Dörfer und Städte (mit gezählten Einwohnern), Siedler, Geld und Märkte, Arm und Reich, Regierungsformen mit Erbfolge, Wahlen und Putschen, Gesetze, Schrift, Statistiken |
| ✅ 9 | **Durch die Epochen** | Bronzezeit bis digitales Zeitalter (13 neue Erfindungen, 9 Zeitalter), Gebäude und Kleidung je Epoche, Seefahrt und Städte auf anderen Kontinenten, Leistung für Millionen Menschen |
| ✅ 10 | **Sci-Fi-Zukunft** | Roboter, KI-Wesen und KI-Regierung, Cyborgs, Klone (auch als Kraft), fliegende Städte, Wettermaschinen gegen dein Wetter, Zeitreisende, die Menschen entdecken dich, Aufstand der Maschinen |
| ✅ 11 | **Feinschliff** | Musik pro Epoche (live erzeugt), Film-Modus mit Untertiteln, Ich-Perspektive, Welt teilen als Datei und als Code mit ganzer Geschichte, Balancing |
| ✅ 12 | **Lebendigere Menschen** | detailreiche Figuren mit Armen, Beinen, Gesichtern und Bewegungen; sichtbare Berufe; Feste, Hochzeiten und Trauerzüge; Lebensträume; beste Freunde, Rivalen und Familienfehden |
| 13 | **Neue Kräfte & Verehrung** | Finsternis, Komet, Nordlicht; Wunderbauwerk; Träume an ein ganzes Volk; Tierwunder; Opfer und Feste; Tempel für dich; Gebete über den Köpfen |
| 14 | **Welt & Weltall** | Kartenansichten (Völker und Grenzen, Bevölkerung, Klima und Nahrung); Regen, Schnee auf Dächern, Nebel, Gewitter; Raketen, Satelliten und Mondbasis |
| 15 | **Komfort** | Zeitsprung bis zum nächsten Ereignis; Startzahl wählbar; Chronik als Buch; Qualitätsstufen; automatische Sicherungen; einfacher Handy-Modus; Spiel ohne Ende nach der fernen Zukunft |

**Erster spielbarer Prototyp:** Meilensteine 1–3. Schon nach Meilenstein 2
kannst du Blitze, Vulkane und Meteoriten auf deinen Planeten werfen. Nach
Meilenstein 3 leben dort die ersten Menschen und Tiere.

---

## 14. Risiken und wie wir damit umgehen

| Risiko | Was wir dagegen tun |
|---|---|
| **3D und viele Menschen sind im Browser zu langsam** | Low-Poly, eine Grafikkarten-Technik für viele gleiche Objekte (Instancing), Simulation im Worker, Simulation in Stufen (Kapitel 12) |
| **Ein runder Planet ist schwieriger als eine flache Karte** | erprobte Technik (Ikosaeder-Kugel, Felder-Netz für die Wege). Der Planet kommt im allerersten Meilenstein, damit wir es früh wissen. |
| **Realistisch langsam wird langweilig** | Zeitsprung, Film-Modus, Auto-Pause und Zusammenfassungen. Und deine Kräfte sorgen jederzeit für Action. |
| **Leichtes Überleben führt zu sehr vielen Menschen** | Simulation in Stufen; große Städte werden ab einer gewissen Größe statistisch gerechnet |
| **Evolution kostet Rechenleistung** | Tiere außerhalb der Sicht werden als Herden gerechnet, mit Genen pro Herde statt pro Tier |
| **Zurückspulen braucht viel Speicher** | komprimierte Rückspulpunkte; alte Punkte werden ausgedünnt (z.B. nur alle 100 Jahre) |
| **Zwei Sprachen bedeuten doppelte Texte** | alle Texte von Anfang an in Sprachdateien; Chronik-Vorlagen gibt es in beiden Sprachen |
| **Die Menschheit stirbt nach einer Katastrophe aus** | Zurückspulen, oder du erschaffst neue Menschen |
| **Geschichten wirken künstlich** | Chronik- und Lebenslauf-Texte aus vielen Satzvorlagen, gefüllt mit echten Ereignissen aus der Simulation |

---

## 15. Noch offen

Das entscheiden wir später, wieder per Klick-Fragen:

- **Musik:** Suchen wir freie Musikstücke, oder lassen wir einfache Musik vom
  Code erzeugen?
- **Planetengrößen:** Wie groß ist „klein“, „mittel“ und „groß“ genau? Das
  testen wir in Meilenstein 1.
- **Zeitmaschinen:** Wie genau sollen sie im Spiel funktionieren?
- **Roboter und KI-Wesen:** Zählen sie als Menschen? Können sie an dich
  glauben?

---

### Nächster Schritt

Wenn dir das Konzept gefällt, starte ich mit **Meilenstein 1: Erster
Planet**. Wenn du etwas ändern willst, sag einfach, welches Kapitel.

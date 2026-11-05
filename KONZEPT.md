# Weltenfunke – Spielkonzept

> **Arbeitstitel.** Ein Lebens-Simulator im Browser, in dem du ein Gott bist.
> Die Menschen leben, lieben, arbeiten, erfinden und streiten von selbst.
> Du schaust zu und greifst ein, wann du willst.

Stand: 5. November 2026 · Version 0.1 · Phase: Konzept (noch kein Code)

---

## Inhalt

1. [Die Idee](#1-die-idee)
2. [Deine Entscheidungen auf einen Blick](#2-deine-entscheidungen-auf-einen-blick)
3. [So könnte eine Partie aussehen](#3-so-könnte-eine-partie-aussehen)
4. [Die Welt](#4-die-welt)
5. [Die Menschen](#5-die-menschen)
6. [Wie sich die Welt von selbst entwickelt](#6-wie-sich-die-welt-von-selbst-entwickelt)
7. [Deine Kräfte als Gott](#7-deine-kräfte-als-gott)
8. [Beobachten: Was du sehen kannst](#8-beobachten-was-du-sehen-kannst)
9. [Die Zeit](#9-die-zeit)
10. [Bildschirm & Steuerung](#10-bildschirm--steuerung)
11. [Grafik-Stil](#11-grafik-stil)
12. [Technik (für die Entwicklung)](#12-technik-für-die-entwicklung)
13. [Fahrplan](#13-fahrplan)
14. [Risiken und wie wir damit umgehen](#14-risiken-und-wie-wir-damit-umgehen)
15. [Noch offen](#15-noch-offen)

---

## 1. Die Idee

Du schaust auf eine lebendige 3D-Welt. Am Anfang gibt es nur eine Handvoll
Steinzeitmenschen. Sie haben Hunger, sie frieren, sie verlieben sich,
bekommen Kinder und sterben. Niemand sagt ihnen, was sie tun sollen: Jeder
Mensch hat einen eigenen Charakter und entscheidet selbst.

Über viele Generationen entdecken sie das Feuer, bauen Hütten, gründen
Stämme, erfinden die Schrift, führen Kriege, bauen Städte und vielleicht
irgendwann Raketen.

Du bist ihr Gott. Du kannst es regnen lassen, Kranke heilen, einem Menschen
eine Idee ins Ohr flüstern oder einen Vulkan ausbrechen lassen. Am Anfang
wissen die Menschen nicht, dass es dich gibt. Wenn sie aber deine Wunder
sehen, beginnen sie zu glauben.

**Das Spiel hat kein festes Ziel.** Es ist eine Sandbox. Die spannende Frage
ist: Was wird aus deiner Welt?

### Die drei Säulen

| Säule | Bedeutung |
|---|---|
| **Echtes Leben im Kleinen** | Jeder Mensch ist ein Individuum mit Charakter, Gefühlen, Gedächtnis, Familie und eigener Lebensgeschichte. |
| **Geschichte im Großen** | Aus vielen kleinen Entscheidungen entstehen von selbst Erfindungen, Wirtschaft, Religionen, Völker und Kriege. |
| **Göttliche Macht** | Deine Kräfte sind unbegrenzt, aber die Menschen behalten ihren freien Willen. |

---

## 2. Deine Entscheidungen auf einen Blick

| # | Frage | Deine Antwort |
|---|---|---|
| 1 | Plattform | **Browser** (PC und Handy, ohne Installation) |
| 2 | Grafik | **3D-Welt** (Low-Poly-Stil, siehe Kapitel 11) |
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
| 18 | Zeit | **Pause und Vorspulen** bis 1000× |
| 19 | Infos | **Alles:** Lebensgeschichte, Weltchronik, Statistiken, Stammbaum |
| 20 | Umfang | **Erst der Plan**, dann bauen |
| + | Technik | **Web-3D mit Three.js** im Projekt `app` |

---

## 3. So könnte eine Partie aussehen

*Ein erfundenes Beispiel, damit man spürt, wie sich das Spiel anfühlt. Was
wirklich passiert, ist jedes Mal anders.*

- **Jahr 1:** Du setzt sechs Menschen an ein Flussufer. **Ara** ist neugierig
  und mutig, **Tok** ist freundlich, aber faul. Sie sammeln Beeren, trinken am
  Fluss und schlafen nachts zusammengekauert unter einer großen Eiche.
- **Jahr 3:** Ara und Tok bekommen ihr erstes Kind, **Mina**. Sie hat Aras
  Neugier und Toks dunkle Haare geerbt.
- **Jahr 19:** Ein Gewitter. Ein Blitz schlägt in eine Eiche ein. Die anderen
  laufen weg, aber Mina (16) traut sich näher und nimmt einen brennenden Ast
  mit. In der Chronik steht: *„Jahr 19: Mina entdeckt das Feuer.“* Sie bringt
  es ihren Kindern bei.
- **Jahr 41:** Die Gruppe ist auf 30 Menschen gewachsen. Zwei Familien
  streiten um die Jagdgründe. Toks Familie zieht flussaufwärts und gründet
  einen eigenen Stamm.
- **Jahr 56:** Eine lange Dürre. Ein alter, frommer Mann tanzt und ruft zum
  Himmel. Genau in diesem Moment lässt du es regnen. Die Menschen sind
  überzeugt: *„Der Himmelsgeist hat uns erhört.“* Der alte Mann wird der erste
  Schamane, und eine Religion entsteht.
- **Jahr 310:** Am Fluss bauen die Menschen Getreide an und werden sesshaft.
  Ein Dorf entsteht, und mit ihm das erste Eigentum und der erste Dieb.
- **Jahr 820:** Zwei Völker, zwei Religionen, ein Krieg um das fruchtbare Tal.
  Du kannst zuschauen, einem Anführer Frieden ins Ohr flüstern oder die Erde
  beben lassen.

---

## 4. Die Welt

- **3D im Low-Poly-Stil:** klare Formen und kräftige Farben, gut lesbar auch
  auf dem Handy.
- **Zufällig erzeugt** aus einer Startzahl (Seed). Mit derselben Zahl entsteht
  dieselbe Welt, was praktisch zum Teilen und Testen ist.
- **Landschaft:** ein Kontinent mit Küsten, Flüssen, Seen, Wäldern, Wiesen,
  Bergen, Wüste und Schnee.
- **Rohstoffe:** Beeren, Wildtiere, Fische, Holz, Stein, Lehm, Kupfer, Zinn,
  Eisen, Kohle und später Öl. Alles, was spätere Epochen brauchen, liegt schon
  von Anfang an in der Welt und wartet darauf, entdeckt zu werden.
- **Tiere:**
  - Beutetiere wie Hirsch, Wildschwein und Fisch
  - gefährliche Tiere wie Wolf und Bär
  - später Nutztiere wie Ziege, Rind und Pferd, wenn die Menschen sie zähmen
- **Tag und Nacht, Jahreszeiten, Wetter:** Im Winter wird Nahrung knapp und es
  ist kalt. Es gibt Regen, Gewitter, Schnee und Dürre.
- **Die Menschen verändern die Welt:** Wälder werden gerodet, Felder angelegt,
  Trampelpfade werden zu Straßen und Dörfer zu Städten.
- **Weltgröße** wählst du beim Start: klein, mittel oder groß.

---

## 5. Die Menschen

### 5.1 Was jeder Mensch hat

| Bereich | Beispiele |
|---|---|
| **Körper** | Alter, Geschlecht, Aussehen (Haut, Haare, Größe), Kraft, Gesundheit |
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

Was ein Mensch gerade denkt, siehst du als **Gedankenblase** über seinem Kopf
(🍖 Hunger, ❤️ Liebe, 💡 Idee, 😠 Wut, 🙏 Gebet).

### 5.3 Gefühle und Gedächtnis

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

### 5.4 Liebe, Familie und Vererbung

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

### 5.5 Lebensphasen, Gesundheit und Tod

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
- **Die Lebenserwartung steigt mit dem Wissen:** Heilkräuter, dann Medizin,
  dann moderne Medizin. In der Steinzeit werden Menschen etwa 30–40 Jahre alt,
  in der Moderne etwa 80.
- **Nach dem Tod:**
  - Angehörige trauern.
  - Später entstehen Begräbnisrituale.
  - Verstorbene bleiben im Archiv. Du kannst ihre Lebensgeschichte und ihren
    Platz im Stammbaum jederzeit ansehen.

### 5.6 Arbeit nach Bedarf und Talent

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
| Zukunft | Forscher, Raumfahrer … |

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

### 6.2 Epochen

Die Epoche wird für **jedes Volk einzeln** bestimmt, und zwar durch seine
wichtigsten Erfindungen. Mit der Epoche ändern sich Kleidung, Werkzeuge,
Gebäude und Lebensweise.

| Epoche | Beispiel-Erfindungen | Typischer Auslöser |
|---|---|---|
| **Altsteinzeit** | Faustkeil, Feuer, Speer, Fellkleidung, Sprache und Gesang | Blitz und Neugier; Kälte |
| **Jungsteinzeit** | Ackerbau, Viehzucht, Töpferei, Lehmhütten | viele Sammler, fruchtbarer Boden, Sesshaftigkeit |
| **Bronzezeit** | Kupfer und Bronze, Rad, Schrift, erste Städte | Erz und Feuer, ein Töpferofen, Handel |
| **Eisenzeit / Antike** | Eisen, Münzgeld, Gesetze, Straßen, Philosophie | Eisenerz, große Reiche, Schreiber |
| **Mittelalter** | Mühlen, Burgen, Zünfte, Seefahrt | Städte und Handel, Konflikte |
| **Neuzeit** | Buchdruck, Schießpulver, Wissenschaft, Entdeckungsreisen | viele Gelehrte, Bibliotheken |
| **Industrie** | Dampfmaschine, Fabriken, Eisenbahn, Elektrizität | Kohle, Metall, Kapital |
| **Moderne** | Auto, Flugzeug, moderne Medizin, Computer | Forschung, große Bevölkerung |
| **Zukunft** | Raumfahrt, künstliche Intelligenz, neue Energie … | offen; die Welt bleibt eine Sandbox |

### 6.3 Wirtschaft

Die Wirtschaft entwickelt sich in Stufen:

1. **Teilen:** Die Gruppe hat einen gemeinsamen Vorrat.
2. **Tauschen:** Fell gegen Fisch, zwischen Menschen und zwischen Stämmen.
3. **Geld:** Es entsteht durch Metallverarbeitung und Handel, zuerst als
   Muscheln oder Metallstücke, später als Münzen.
4. **Märkte und Arbeit gegen Lohn:** Preise entstehen aus Angebot und
   Nachfrage.
5. **Moderne Wirtschaft:** Banken, Fabriken, Handel über Kontinente.

Was daraus folgt:

- **Eigentum** entsteht: Felder, Häuser und Vorräte gehören jemandem. Durch
  Erbe gibt es **reiche und arme Familien**.
- **Ungleichheit hat Folgen:** Neid, Diebstahl und Aufstände, aber auch
  Fleiß und Aufstieg.

### 6.4 Gemeinschaft, Völker und Politik

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

### 6.5 Konflikte, Verbrechen und Krieg

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
- **Darstellung:** stilisiert im Low-Poly-Look, nicht blutig.

### 6.6 Glaube und Religion

Die Menschen **entdecken dich selbst**. Das läuft in vier Stufen ab:

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
  Köpfen, zum Beispiel *„Bitte lass es regnen“*.
- Erhörst du ein Gebet, wird der Glaube stärker. Ignorierst du Gebete,
  kommen Zweifel.

**Glaube verändert das Verhalten:**

- Er spendet Trost bei Trauer.
- Er stärkt den Zusammenhalt.
- Seine Gebote führen zu weniger Verbrechen.
- Er führt aber auch zu Streit zwischen Religionen, zu Spaltungen und zu
  Glaubenskriegen.
- In späteren Epochen kommen Zweifel und Unglaube dazu.

---

## 7. Deine Kräfte als Gott

Deine Kräfte sind **unbegrenzt** und kosten nichts. Alles, was du tust, hat
aber **Folgen**, und die Menschen sehen es.

### 🌩️ Natur

- Regen, Dürre, Sonnenschein
- Gewitter, auch ein gezielter Blitz
- Sturm, Schnee, Hitzewelle
- Erdbeben, Vulkanausbruch, Flut
- Feuer legen und Feuer löschen
- Landschaft formen: Berge heben, Täler senken, Flüsse ziehen, Inseln
  erschaffen
- Wälder und Pflanzen wachsen lassen

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

- Menschen erschaffen, entweder zufällig oder selbst gestaltet (Name,
  Aussehen, Charakter)
- Tiere erschaffen: Herden oder Raubtiere
- Einen Menschen sterben lassen: friedlich im Schlaf oder durch einen Blitz
- Eine Seuche schicken
- **Hand Gottes:** einen Menschen aufheben und woanders absetzen

### Sichtbar oder unsichtbar?

Das ist wichtig für den Glauben:

| Unsichtbar (gilt als Natur oder Zufall) | Sichtbar (gilt als Wunder) |
|---|---|
| Gedanken flüstern | Blitz aus klarem Himmel |
| normales Wetter | Wiederbeleben, plötzliche Heilung |
| langsames Wachstum | Hand Gottes, Himmelszeichen |
| | Regen genau im Moment eines Gebets |

Du entscheidest also selbst, ob du **im Verborgenen lenkst** oder dich **zeigst**.

---

## 8. Beobachten: Was du sehen kannst

### 📖 Lebensgeschichte

Klickst du einen Menschen an, öffnet sich seine Akte:

- Porträt, Name, Alter, Volk, Beruf
- Charakter als Balken, z.B. Neugier ████████░░
- Bedürfnisse und Stimmung mit Gründen, z.B. „+10 hat gut gegessen“
- Gedanken: *„Ich habe Hunger. Ich gehe zum Beerenstrauch am Fluss.“*
- Beziehungen: Familie, Freunde, Feinde
- Wissen und Glaube
- **Lebenslauf**, der sich selbst schreibt: *„Geboren im Frühling des Jahres
  12. Lernte von ihrer Mutter das Feuermachen. Verliebte sich mit 17 in Kel.
  Überlebte die Große Flut. Starb mit 43 an Fieber.“*
- Knöpfe: **Folgen** (die Kamera begleitet den Menschen), **Flüstern**,
  **Segnen** …

### 📜 Weltchronik

Ein Geschichtsbuch, das sich selbst schreibt:

> *Jahr 19 – Mina entdeckt das Feuer, nachdem ein Blitz in eine Eiche schlug.*
> *Jahr 41 – Die Familie von Tok spaltet sich ab und gründet den Stamm der Tokar.*
> *Jahr 56 – Nach dem Regenwunder entsteht der Glaube an den Himmelsgeist.*

- Die Epochen sind die **Kapitel**.
- Wichtige Ereignisse sind hervorgehoben.
- Du kannst nach Volk, Person oder Art des Ereignisses filtern, z.B.
  Erfindungen, Kriege oder Religion.

### 📊 Statistiken

Diagramme über die Zeit, auch zum Vergleichen der Völker:

- Bevölkerung, Geburten und Todesfälle
- Glück und Lebenserwartung
- Wissen: Anzahl der Erfindungen
- Reichtum und Ungleichheit
- Glaube: Anteil der Gläubigen und Anzahl der Religionen
- Konflikte: Verbrechen und Kriege

### 🌳 Stammbaum

- Er ist interaktiv und reicht über alle Generationen.
- Vererbung wird sichtbar, z.B. *„rote Haare von Urgroßmutter Ara“*.
- Mit einem Klick auf einen Vorfahren siehst du seine Lebensgeschichte.

### 🔔 Benachrichtigungen

- Wichtige Momente erscheinen als Meldung, z.B. *„Eine neue Erfindung!“*,
  *„Ein Krieg beginnt!“* oder *„Ein Prophet steht auf!“*.
- Auf Wunsch hält das Spiel dabei automatisch an (**Auto-Pause**).

---

## 9. Die Zeit

- **Steuerung:** ⏸ Pause · ▶ 1× · ▶▶ 10× · ▶▶▶ 100× · ⏩ 1000×
- **Kalender (Richtwert):** 1 Jahr hat 4 Jahreszeiten zu je 10 Tagen.

| Geschwindigkeit | Ein Tag dauert | Ein Jahr dauert | Gut für |
|---|---|---|---|
| 1× | ca. 1 Minute | ca. 40 Minuten | den Alltag einzelner Menschen beobachten |
| 10× | ca. 6 Sekunden | ca. 4 Minuten | Jahreszeiten, Ernten, Kinder aufwachsen sehen |
| 100× | ca. 0,6 Sekunden | ca. 24 Sekunden | Generationen |
| 1000× | – | ca. 2,4 Sekunden | Jahrhunderte (1000 Jahre in ca. 40 Minuten) |

- **Warum ein kurzes Jahr?** Damit Generationen und Epochen in vernünftiger
  Spielzeit vergehen. Die genauen Werte stellen wir beim Testen ein.
- **Zeitraffer-Modus ab 100×:** Die Menschen laufen nicht mehr Schritt für
  Schritt herum. Die Simulation rechnet in größeren Schritten, und du siehst,
  wie Dörfer wachsen und Wälder verschwinden.
- **Auto-Pause** bei wichtigen Ereignissen. Du stellst ein, bei welchen.

---

## 10. Bildschirm & Steuerung

```
┌──────────────────────────────────────────────────────────────────┐
│ Jahr 214 · Sommer · Jungsteinzeit   👥 38   ⏸ ▶ ▶▶ ▶▶▶ ⏩        │
├────┬───────────────────────────────────────────────┬─────────────┤
│ 🌩️ │                                               │  Ara (34)   │
│ ✨ │                                               │  Sammlerin  │
│ 💭 │            3D-Welt                            │  ❤️ 😊 🍖    │
│ ⚖️ │   (drehen, zoomen, Menschen anklicken)        │  Neugier ██ │
│    │                                               │  …          │
│ 📜 │                                               │ [Folgen]    │
│ 📊 │                                               │ [Flüstern]  │
│ 🌳 │                                               │             │
├────┴───────────────────────────────────────────────┴─────────────┤
│ 📜 Jahr 214: Kel erfindet die Töpferei · Jahr 213: Tok stirbt …  │
└──────────────────────────────────────────────────────────────────┘
```

- **Links:** Götterkräfte (Natur, Segen, Flüstern, Leben & Tod), darunter
  Chronik, Statistiken und Stammbaum.
- **Rechts:** Infos zu dem, was du angeklickt hast (Mensch, Volk, Ort).
- **Unten:** Ereignis-Ticker.
- **Maus:** Mit gedrückter rechter Taste drehst du die Kamera, mit dem
  Mausrad zoomst du, mit der linken Taste oder WASD verschiebst du sie. Ein
  Klick wählt aus.
- **Handy:** Mit zwei Fingern drehst und zoomst du. Die Seitenleisten werden
  zu Fenstern, die von unten hochfahren.
- **Zoomstufen:**
  - **nah:** Gesichter und Gedankenblasen
  - **mittel:** das Dorf und seine Arbeit
  - **weit:** Völker, Grenzen und Handelswege wie auf einer Landkarte

---

## 11. Grafik-Stil

- **Low-Poly:** Alles besteht aus wenigen flachen Flächen. Das läuft flüssig
  im Browser und auf dem Handy und sieht trotzdem schön aus.
- **Im Code erzeugt:** Menschen, Häuser und Bäume werden aus einfachen Formen
  zusammengesetzt. So können wir für jede Epoche passende Varianten bauen,
  ohne Hunderte Modelle zu brauchen. Später kommen optional freie
  Modell-Pakete (CC0-Lizenz) dazu.
- **Menschen:** einfache, freundliche Figuren. Ihr Aussehen kommt aus den
  Genen, ihre Kleidung hängt von Epoche und Beruf ab.
- **Gebäude im Wandel:** Lager unter Bäumen, dann Zelte, Lehmhütten,
  Steinhäuser, Fachwerkhäuser und Burgen, Fabriken, Hochhäuser und zuletzt
  Zukunftsstädte.
- **Licht:** Tag und Nacht. Nachts leuchten Lagerfeuer, später elektrisches
  Licht in den Städten.
- **Wetter:** Regen, Schnee, Gewitter und Nebel als einfache Effekte.

---

## 12. Technik (für die Entwicklung)

| Bereich | Wahl | Warum |
|---|---|---|
| Sprache | TypeScript | weniger Fehler bei einer großen Simulation |
| Build | Vite | schneller Start, einfache Veröffentlichung |
| 3D | Three.js (WebGL) | verbreitet, läuft in jedem modernen Browser |
| Oberfläche | HTML/CSS-Overlay mit Preact | klein und schnell, gut für Fenster und Listen |
| Simulation | eigener Kern in einem **Web Worker** | rechnet getrennt von der Grafik, damit das Bild nicht ruckelt |
| Zufall | deterministisch mit Seed | gleiche Startzahl ergibt gleiche Geschichte; gut zum Testen |
| Speichern | Autosave in IndexedDB + Export als Datei | Spielstand bleibt erhalten und kann geteilt werden |
| Diagramme | uPlot | sehr klein und schnell |
| Tests | Vitest + Playwright | Simulation testen, Screenshots im Browser prüfen |
| Veröffentlichung | z.B. GitHub Pages | das Spiel als Link öffnen |

### Aufbau

```
┌─────────────────────────┐   Zustand (kompakt)  ┌──────────────────────────┐
│  Simulation (Worker)    │ ───────────────────► │  Darstellung (Three.js)  │
│  · Welt, Wetter         │                      │  · Gelände, Menschen     │
│  · Menschen, Entscheid. │ ◄─────────────────── │  · Gebäude, Effekte      │
│  · Wissen, Wirtschaft   │   Götterkräfte,      ├──────────────────────────┤
│  · Völker, Glaube       │   Zeitsteuerung      │  Oberfläche (Preact)     │
│  · Chronik-Ereignisse   │                      │  · Akte, Chronik, Stats  │
└─────────────────────────┘                      └──────────────────────────┘
```

### Simulation in Stufen (damit es auch mit vielen Menschen flüssig bleibt)

| Stufe | Für wen | Wie genau |
|---|---|---|
| **Detail** | Menschen in Kameranähe | jeder Schritt, Gespräche, Animation |
| **Normal** | Menschen außerhalb der Sicht | Entscheidungen in größeren Zeitschritten, keine Animation |
| **Statistisch** | Hintergrund-Bevölkerung großer Städte (ab Moderne) | als Gruppen gerechnet |

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
}
```

- Erfindungen, Berufe, Gebäude und Epochen werden als **Daten**
  beschrieben, nicht fest im Code. Eine neue Erfindung ist dann nur ein neuer
  Eintrag.
- Ein Simulationsschritt entspricht 10 Spielminuten.

---

## 13. Fahrplan

Jeder Meilenstein endet mit einer **spielbaren Version als Link**. Du testest
sie, und ich stelle dir wieder Klick-Fragen für die nächsten Schritte.

| # | Meilenstein | Was du danach sehen und tun kannst |
|---|---|---|
| ✅ 0 | **Konzept** | dieses Dokument |
| 1 | **Erste Welt** | zufällige 3D-Insel mit Wald, Fluss und Bergen, Tag und Nacht, Kamera, Zeitsteuerung |
| 2 | **Erste Menschen** | 6 Menschen mit Hunger, Durst und Schlaf; sie laufen, sammeln und schlafen; Anklicken zeigt ihre Akte |
| 3 | **Leben & Liebe** | Charakter, Gefühle, Beziehungen, Altern und Tod, Kinder mit Vererbung, Stammbaum |
| 4 | **Gottes Hand** | Götterkräfte (Natur, Segen, Leben & Tod, Flüstern) und Weltchronik |
| 5 | **Wissen & Arbeit** | Erfindungen entstehen von selbst, Wissen wird weitergegeben, Arbeit nach Bedarf, erste Hütten und Feuerstellen |
| 6 | **Glaube** | die Menschen entdecken dich, Schamanen, Religionen, Gebete |
| 7 | **Stämme** | Anführer, Abspaltung, mehrere Völker, Tauschhandel, Streit, Verbrechen, Krieg |
| 8 | **Zivilisation** | Ackerbau, Dörfer und Städte, Geld und Märkte, Regierungsformen, Gesetze, Schrift, Statistiken |
| 9 | **Durch die Epochen** | Bronzezeit bis Zukunft, neue Gebäude und Kleidung, Zeitraffer und Leistung für große Bevölkerungen |
| 10 | **Feinschliff** | Speichern und Laden, Geräusche und Musik, Handy-Steuerung, Balancing |

**Erster spielbarer Prototyp:** Meilensteine 1–3. Danach kannst du schon
zusehen, wie eine kleine Steinzeitfamilie lebt, sich verliebt, Kinder bekommt
und Generationen bildet.

---

## 14. Risiken und wie wir damit umgehen

| Risiko | Was wir dagegen tun |
|---|---|
| **3D und viele Menschen sind im Browser zu langsam** | Low-Poly, eine Grafikkarten-Technik für viele gleiche Objekte (Instancing), Simulation im Worker, Simulation in Stufen (Kapitel 12) |
| **Die Welt bleibt stecken oder die Menschen sterben aus** | automatische Testläufe über 1000+ Jahre mit vielen Startzahlen; Regler im Entwickler-Menü. Stirbt die Menschheit aus, kannst du neue Menschen erschaffen. |
| **Steinzeit bis Zukunft ist ein riesiger Umfang** | Epoche für Epoche bauen. Inhalte sind Daten, neue Erfindungen und Gebäude lassen sich leicht ergänzen. |
| **Wenige Startmenschen finden keine Partner** | Standard sind 6 nicht verwandte Menschen; das Spiel gibt einen Hinweis und du kannst Menschen erschaffen |
| **Geschichten wirken künstlich** | Chronik- und Lebenslauf-Texte aus vielen Satzvorlagen, gefüllt mit echten Ereignissen aus der Simulation |

---

## 15. Noch offen

Das entscheiden wir später, wieder per Klick-Fragen:

- **Name des Spiels.** „Weltenfunke“ ist nur ein Arbeitstitel.
- **Sprache:** zuerst Deutsch, später auch Englisch?
- **Welt:** ein großer Kontinent oder mehrere Inseln?
- **Musik und Geräusche:** welche Stimmung?
- **Die Zukunft:** Wie weit soll sie gehen? Raumfahrt, andere Planeten?

---

### Nächster Schritt

Wenn dir das Konzept gefällt, starte ich mit **Meilenstein 1: Erste Welt**.
Wenn du etwas ändern willst, sag einfach, welches Kapitel.

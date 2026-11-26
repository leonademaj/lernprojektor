# Mika und der Sternenleuchtturm

Statisches Browser-Minigame für Kinder in der 2. Klasse. Mika reist mit den Kindern durch den Hafen, über eine Insel und in den Leuchtturm. Zwölf Aufgaben üben Plus und Minus bis 100.

## Lokal testen

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory public
```

Anschließend [http://127.0.0.1:8765](http://127.0.0.1:8765) öffnen. Die Webdemo verwendet ein Zahlenfeld, vier stumme WebM-Clips sowie ein- und ausschaltbare Töne und Sprachausgabe. Die Sprachausgabe hängt von den verfügbaren Browserstimmen ab. Bei reduzierter Bewegung oder falls ein Clip nicht abgespielt werden kann, erscheint die Illustration. Die Spielauswertung läuft im Browser und benötigt weder Konto noch API-Schlüssel. Ein Neuladen setzt die Runde zurück.

## Über GitHub und Vercel veröffentlichen

Das Repository in Vercel als neues Git-Projekt importieren. Das Root Directory bleibt das Repository-Hauptverzeichnis. Die Datei `vercel.json` setzt das öffentliche Verzeichnis auf `public`. Installation, Build und Umgebungsvariablen werden für diese statische Anwendung nicht benötigt.

## Inhalt und Logik

- `public/geschichte.json` enthält Einleitung, Kapitel, Ende und die Zuordnung der Videodateien unter `public/assets/`.
- `public/aufgaben.json` enthält jede Szene, beide Operanden, den Operator, den allgemeinen Tipp, einen vorbereiteten Fehlwert mit gezieltem Tipp und den Lösungsweg.
- `public/spiel.mjs` prüft die Zahl, verwaltet die Versuche und vergibt Sterne.

Bei `36 + 20` gibt `56` einen Stern. `38` löst den Tipp zu den zwei Zehnern aus. Eine andere falsche Zahl zeigt den allgemeinen Tipp. Ein leeres oder ungültiges Feld verbraucht keinen Versuch. Nach zwei falschen Antworten zeigt Mika den Rechenweg und das Kind setzt die Geschichte fort. Auch mit null Sternen erreicht man das Ende.

Die Spielinhalte stammen aus dem lokalen Raspberry-Pi-Entwicklungsstand. Die gehostete Demo hat eine eigene Browser-Eingabe, während der Pi-Prototyp die Hardware lokal anbinden kann.

## Lernpfade

Die Startseite lässt zwischen Leuchtturm (Plus und Minus) und Sachaufgaben zum kleinen Einmaleins wählen. Der Leuchtturm ist über `leuchtturm.html` erreichbar. `einmaleins.html` lädt seine Szenen in der Reihenfolge aus `public/einmaleins.json`. Die Obststand-Szenen sind als Beispiel markiert.

Für die fertige Einmaleins-Geschichte `beispiel` auf `false` setzen und Titel, Abschluss und Szenen ersetzen. Medien unter `public/assets/` ablegen und je Szene über die folgenden Felder zuordnen. Unterstützte Bild- und Videoformate richten sich nach dem Browser.

| Feld | Inhalt |
| --- | --- |
| `titel`, `text` | Überschrift und Text. Bei einer Aufgabe enthält der Text auch die Frage. |
| `bild`, `bildAlt` | Optionaler Bildpfad und Bildbeschreibung, etwa `./assets/einmaleins/szene-01.webp`. |
| `audio` | Optionaler MP3-Pfad. Die Tonspur erhält eine eigene Abspielsteuerung. |
| `video` | Optionaler Videopfad mit Abspielsteuerung. Ist auch ein Bild gesetzt, dient es als Ersatz bei einem Videofehler. |
| `aufgabe` | Optional. Faktoren `a` und `b` von 1 bis 10, `hinweis`, `weg` sowie optional `extra_hinweis` mit Fehlwert `bei` und `text`. Die Software berechnet die Lösung als Produkt. |

Szenen ohne Aufgabe lassen sich direkt weiterklicken. Bei einer Aufgabe geht es nach einer richtigen Antwort oder nach der Erklärung im zweiten Fehlversuch weiter. Beim Zurückblättern bleiben die Antworten der laufenden Runde erhalten.

## Gesprochene Antworten in der Webdemo

In beiden Lernpfaden öffnet **Antwort sprechen** die browserseitige Erkennung für Deutsch. Nach Aktivierung von **Auto-Mikrofon an** startet die Erkennung nach dem Vorlesen beziehungsweise am Ende der Szene mit Tonspur oder Video. Bei einer reinen Textaufgabe startet sie beim Anzeigen der Aufgabe. **Antwort sprechen** startet die Erkennung auch einzeln. Eindeutig erkannte Zahlen von null bis hundert werden direkt bewertet. Stille oder eine unklare Aufnahme zählen nicht als Versuch. Je nach Browser kann die Aufnahme zum Dienst des Browsers übertragen werden. Die Anwendung speichert keine Audiodateien oder Transkripte. Wenn die Erkennung nicht verfügbar oder die Mikrofonfreigabe gesperrt ist, bleibt das Zahlenfeld bedienbar. Die lokale Raspberry-Pi-Version verwendet ihren eigenen Sprachmodus.

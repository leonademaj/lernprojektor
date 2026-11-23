# Mika und der Sternenleuchtturm

Statisches Browser-Minigame für Kinder in der 2. Klasse. Mika reist mit den Kindern durch den Hafen, über eine Insel und in den Leuchtturm. Zwölf Aufgaben üben Plus und Minus bis 100.

## Lokal testen

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory public
```

Anschließend [http://127.0.0.1:8765](http://127.0.0.1:8765) öffnen. Die Webdemo verwendet ein Zahlenfeld und optional einen kurzen Belohnungston. Sie verarbeitet Eingaben im Browser und benötigt weder Konto noch API-Schlüssel. Ein Neuladen setzt die Runde zurück.

## Über GitHub und Vercel veröffentlichen

Das Repository in Vercel als neues Git-Projekt importieren. Das Root Directory bleibt das Repository-Hauptverzeichnis. Die Datei `vercel.json` setzt das öffentliche Verzeichnis auf `public`. Installation, Build und Umgebungsvariablen werden für diese statische Anwendung nicht benötigt.

## Inhalt und Logik

- `public/geschichte.json` enthält Einleitung, Kapitel und Ende.
- `public/aufgaben.json` enthält jede Szene, beide Operanden, den Operator, den allgemeinen Tipp, einen vorbereiteten Fehlwert mit gezieltem Tipp und den Lösungsweg.
- `public/spiel.mjs` prüft die Zahl, verwaltet die Versuche und vergibt Sterne.

Bei `36 + 20` gibt `56` einen Stern. `38` löst den Tipp zu den zwei Zehnern aus. Eine andere falsche Zahl zeigt den allgemeinen Tipp. Ein leeres oder ungültiges Feld verbraucht keinen Versuch. Nach zwei falschen Antworten zeigt Mika den Rechenweg und das Kind setzt die Geschichte fort. Auch mit null Sternen erreicht man das Ende.

Die Spielinhalte stammen aus dem lokalen Raspberry-Pi-Entwicklungsstand. Die gehostete Demo hat eine eigene Browser-Eingabe, während der Pi-Prototyp die Hardware lokal anbinden kann.

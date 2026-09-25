# Küchenkompass

Gemeinsam nachhaltig kochen: WS 1 und WS 2 erfassen Gerichte und acht Antworten pro Kochtag. Auswertungen lassen sich nach Klasse und Zeitraum filtern und drucken.

## Veröffentlichung mit GitHub Pages

Die fertige Webseite liegt im Ordner `docs`.

1. Im Repository **Settings → Pages** öffnen.
2. Unter **Build and deployment** die Quelle **Deploy from a branch** wählen.
3. Branch **main**, Ordner **/docs** auswählen und **Save** anklicken.
4. Die von GitHub bestätigte Adresse öffnen. Der konfigurierte Projektpfad ist `/K-chenkompass/`.

## Zentrale Speicherung

GitHub Pages liefert ausschließlich die Oberfläche. Die API und die bestehende Cloudflare-D1-Datenbank laufen weiterhin auf der vorhandenen Site:
`https://kuechenkompass.tituzzz.chatgpt.site`

Gerichte, Antworten und Kochtage werden auf dem Server gespeichert, nicht in localStorage oder in diesem Repository. Beide Oberflächen greifen auf dieselben Daten zu. Ungespeicherte Eingaben befinden sich bis zum Speichern im Arbeitsspeicher des geöffneten Tabs.

Die GitHub-Oberfläche verwendet ein kurzlebiges, serverseitig signiertes Sitzungstoken ausschließlich im Arbeitsspeicher. Dadurch werden keine Drittanbieter-Cookies benötigt. Nach Neuladen ist eine erneute Anmeldung erforderlich. Passwörter und Signaturschlüssel stehen ausschließlich in der Serverkonfiguration. Die API prüft das Klassenrecht für jeden Schreibzugriff. Freigegebener Browser-Ursprung: `https://danielbergmann-dev.github.io`.

## Weiterentwicklung

Node.js entsprechend `package.json` und die dort angegebene pnpm-Version verwenden:

```sh
pnpm install --frozen-lockfile
pnpm run build:pages
```

Danach die Quelltextänderungen zusammen mit dem aktualisierten Ordner `docs` committen. Der Pages-Build verwendet `vite.pages.config.ts`; der vorhandene Server-Build verwendet `vite.config.ts`. Änderungen an `app/api`, `lib/class-access.ts`, der Datenbank oder anderen Serverdateien erfordern zusätzlich eine Veröffentlichung der Site. Ein GitHub-Push allein aktualisiert den Server nicht.

## Server und Datenbank

- `app/api`: Anmeldung und Kochtage
- `lib/class-access.ts`: Klassenrechte und signierte Sitzungen
- `db/schema.ts`: Datenbankschema
- `drizzle`: versionierte Migrationen
- `app/page.tsx`, `app/kitchen.css`: gemeinsame Oberfläche
- `lib/api-client.ts`: Verbindung zur API

Historische Migration `0003_clear_cooking_days.sql` dokumentiert die einmalige, ausdrücklich beauftragte Datenlöschung. Sie ist bereits auf dem bestehenden Server ausgeführt. Keine historischen Migrationen manuell erneut ausführen.

Tests:

```sh
node scripts/test-class-access.mjs
```

Keine `.env`-Dateien, Zugangsdaten oder Datenbankexporte ins Repository aufnehmen.

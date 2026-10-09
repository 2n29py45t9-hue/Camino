# Camino – Spanisch lernen

Eine eigenständige Camino-Web-App auf Next.js, TypeScript und Tailwind CSS, vorbereitet für Supabase Authentication. Das Supabase-Projekt `camino` enthält laut Setup bereits Tabellen, RLS-Regeln, Trigger und Lerninhalte.

## Lokal starten

Voraussetzung: Node.js 20.9 oder neuer (empfohlen: Node.js 22) und npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Öffne anschließend [http://localhost:3000](http://localhost:3000). In `.env.example` stehen die bereitgestellte Supabase-Projekt-URL und der **Publishable Key**. `.env.local` ist lokal und wird von Git ignoriert.

Für Vercel oder andere Deployments dieselben beiden Variablen setzen:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Der Publishable Key ist für die Verwendung im Browser vorgesehen. Er ist kein Ersatz für Row-Level Security: RLS muss in Supabase aktiviert bleiben; **Service-Role-Keys gehören niemals in den Browser oder ins Git-Repository**.

## Supabase Authentication

Die App unterstützt Registrierung, Anmeldung, persistente Browser-Sessions und Abmeldung über Supabase Auth. Wenn Supabase E-Mail-Bestätigungen verlangt, bestätige die Registrierung über den Link in deinem Postfach. Für Tests kann „Confirm email“ im Supabase-Dashboard vorübergehend ausgeschaltet werden.

In Supabase unter **Authentication → URL Configuration** die lokale URL `http://localhost:3000` und später die öffentliche Produktions-URL als Site URL beziehungsweise Redirect URL zulassen. Für Vercel zusätzlich die dort erzeugte Domain eintragen.

## Wichtiger Hinweis zum Lernfortschritt

Der erwähnte Canvas **„Camino Web-App – app/page.tsx“** war in diesem Repository und in der Anfrage nicht enthalten. Deshalb enthält `app/page.tsx` eine eigenständige Startseite mit Supabase-Auth und einer klar als Vorschau markierten Saludos-Übung. Die eigentlichen Canvas-Lektionen sowie das Speichern von XP, Streaks, Wiederholungen und täglichen Aktivitäten in `profiles`, `lesson_completions`, `srs_cards` und `daily_activity` sind noch nicht angeschlossen. Dafür werden der Canvas-Seitencode und – falls die Feldnamen dort nicht festgelegt sind – das Supabase-Schema benötigt. Es werden absichtlich keine Datenbank-Schreibvorgänge mit geratenen Spaltennamen ausgeführt.

## Deployment mit Vercel

1. Dieses Repository in Vercel importieren.
2. In **Project Settings → Environment Variables** `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` setzen.
3. Deploy ausführen.
4. Die Vercel-URL in Supabase unter **Authentication → URL Configuration** als Site URL und Redirect URL ergänzen.

Vercel erkennt Next.js automatisch; ein eigener Build-Befehl ist nicht nötig. Die Projekt-Checks kannst du lokal ausführen:

```bash
npm run lint
npm run build
```

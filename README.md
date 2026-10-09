# Camino – Spanisch lernen (Web-App)

Next.js-App (App Router, TypeScript, Tailwind) mit Supabase als Backend.
Tabellen, RLS, Trigger und 66 Übungen sind bereits im Supabase-Projekt `camino` eingerichtet.

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte eintragen (siehe Datei)
npm run dev                  # → http://localhost:3000
```

## Erster Test

1. Konto registrieren → Lernpfad erscheint → Lektion „Saludos" spielen.
2. XP, Streak und Wiederholungen landen in Supabase (Tabellen `profiles`, `lesson_completions`, `srs_cards`, `daily_activity`).

## E-Mail-Bestätigung

Supabase verlangt standardmäßig eine E-Mail-Bestätigung. Entweder im Dashboard unter
Authentication → Sign In / Up Providers → Email „Confirm email" ausschalten (nur für Tests),
oder unter Authentication → URL Configuration die Site URL `http://localhost:3000` (später die Produktions-URL) eintragen.

## Deployment (Vercel)

1. Repo auf GitHub pushen.
2. vercel.com → Add New Project → Repo importieren.
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` eintragen.
4. Deploy → öffentliche URL (z. B. `camino-web.vercel.app`).
5. Diese URL in Supabase unter Authentication → URL Configuration als Site URL und Redirect URL ergänzen.

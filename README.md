# Rabotaem.md

Platformă de lucru din Republica Moldova: **lucru rapid** (munci ocazionale, de la 16 ani) și **angajare oficială** (cu CV, doar de la 18 ani).

## Tehnologii

- [TanStack Start](https://tanstack.com/start) (React 19, server functions), Vite, Tailwind CSS
- PostgreSQL (`DATABASE_URL`); fără ea, local se folosește PGLite
- Better Auth (conturi), Twilio (SMS), bot Telegram (verificare și notificări), Firebase (push)
- Găzduire: Render, cu Cloudflare în față

## Pornire locală

```bash
npm install
npm run dev            # http://localhost:8080 (PGLite, fără configurare)
```

Variabilele de mediu sunt descrise în `.env.example`. Nu pune niciodată chei sau parole în cod.

## Verificări

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm run build          # build de producție + migrări (dacă DATABASE_URL e setată)
npm test               # test în browser al paginilor principale (site pornit + DATABASE_URL)
```

La fiecare PR, GitHub Actions (`.github/workflows/ci.yml`) rulează toate acestea pe o bază de date PostgreSQL de test. Nu se face merge dacă verificarea e roșie.

## Baza de date

Schema este în `migrations/*.sql` (rulate în ordine, o singură dată). La deploy, `npm run build` le aplică pe baza de date din `DATABASE_URL`.

## Deploy

Render face deploy automat la fiecare commit pe `main`:

- Build: `npm install; npm run build`
- Start: `node .output/server/index.mjs`

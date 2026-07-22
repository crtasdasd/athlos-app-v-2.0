# ATHLOS — backend (Supabase) navodila

Aplikacija **že deluje brez backenda** (demo način: e-pošta začne z `athlos@`, geslo `123`).
Ko narediš spodnje korake, samodejno preklopi na pravi Supabase backend — nič drugega ti ni treba spreminjati.

## 1. Ustvari Supabase projekt
1. Pojdi na https://supabase.com → **New project** (brezplačno).
2. Izberi ime in geslo za bazo, počakaj ~1 min, da se ustvari.

## 2. Naredi tabele
1. V Supabase odpri **SQL Editor → New query**.
2. Prilepi celotno vsebino datoteke [`supabase/schema.sql`](supabase/schema.sql) in klikni **Run**.
   - To naredi tabelo `profiles`, varnostna pravila (vsak vidi le svoj profil) in samodejno kreiranje profila ob registraciji.

## 3. Prilepi ključa v aplikacijo
1. V Supabase: **Project Settings → API**.
2. Kopiraj **Project URL** in **anon public / publishable** ključ.
3. V mapi projekta kopiraj `.env.example` → preimenuj v `.env` in vstavi:
   ```
   VITE_SUPABASE_URL=https://tvoj-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=tvoj-anon-key
   ```
4. Za Netlify deploy dodaj isti dve vrednosti v **Site settings → Environment variables**.

Pomembno:
- `VITE_SUPABASE_ANON_KEY` je javen client ključ in konča v browser bundle-u. Varnost zagotavljajo RLS pravila v `supabase/schema.sql`.
- `service_role` ključ, AI ključi (`GEMINI_API_KEY`, `ANTHROPIC_API_KEY`) in drugi secret ključi ne smejo biti nikoli v `.env`, če imajo prefix `VITE_`, in ne smejo biti v `netlify.toml`.
- Secret ključe dodaj samo v Supabase Edge Function Secrets ali drug server-side secret store.

## 4. (priporočeno) Izklopi potrditev e-pošte za začetek
- Supabase: **Authentication → Sign In / Providers → Email** → izklopi *Confirm email*.
- Tako se po registraciji takoj prijaviš (drugače moraš najprej potrditi e-pošto).

## 5. Zaženi aplikacijo
- Ustavi in znova zaženi dev (`npm run dev`), da se `.env` naloži.
- Klikni **Registracija** v aplikaciji, ustvari račun → dokončaj profil → vse se shrani v Supabase.
- Profil in nastavitve so zdaj v oblaku; prijava deluje na vseh napravah; refresh te ne odjavi.

## 6. Treningi, sezona in AI zgodovina (nove tabele)

V **SQL Editor** še enkrat zaženi celotno datoteko [`supabase/schema.sql`](supabase/schema.sql) —
dodane so tabele `season_events` (koledar), `workouts` (opravljeni treningi) in `ai_messages` (AI pogovor).
Datoteka je idempotentna — varno jo je zagnati večkrat.

## 7. Pravi AI trener (Edge Function) — opcijsko

Brez tega koraka AI klepet deluje z demo odgovori. Funkcija podpira DVA ponudnika
(uporabi prvega, ki deluje):

- **Claude** (`ANTHROPIC_API_KEY`) — najboljši odgovori; plačljivo (console.anthropic.com → Plans & Billing → krediti)
- **Google Gemini** (`GEMINI_API_KEY`) — **BREZPLAČNO** (do ~1500 zahtev/dan): https://aistudio.google.com → "Get API key"

Koraki:

1. Pridobi vsaj en ključ (za zastonj testiranje: Gemini na aistudio.google.com — prijava z Google računom → Get API key → Create API key).
2. V Supabase: **Edge Functions → Deploy a new function → Via Editor** → ime: `ai-coach` →
   prilepi vsebino datoteke [`supabase/functions/ai-coach/index.ts`](supabase/functions/ai-coach/index.ts) → Deploy.
   (Če funkcija že obstaja: odpri jo → Edit/Code → zamenjaj kodo → Deploy.)
3. V Supabase: **Edge Functions → Secrets** → dodaj `GEMINI_API_KEY` in/ali `ANTHROPIC_API_KEY`.
4. To je vse — aplikacija funkcijo najde sama; če je ni ali noben ključ ne dela, tiho pade nazaj na demo odgovore.

## Kako je narejeno (za kasneje)
- Vsa logika je v `src/lib/api.js`. Aplikacija se nikoli ne pogovarja s Supabase neposredno.
- Če ključev ni → demo način (localStorage). Če so → Supabase. Isti vmesnik za oboje.
- Demo način hashira lokalno geslo v `localStorage`, vendar to ni produkcijski auth. Za prave uporabnike uporabljaj Supabase Auth.
- Naslednji koraki, ko boš želel: shranjevanje treningov/sezone v bazo (dodaj tabele + funkcije v `api.js`),
  AI prek Supabase Edge Function (skrit API ključ).

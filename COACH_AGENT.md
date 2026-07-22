# ZEUS — učeči se AI trener (integracija agenta)

ATHLOS-ov AI Coach ("ZEUS" tab) je nadgrajen iz navadnega chatbota v **učečega se agenta z memory bazo**.
Dva koncepta, kot želeno:

1. **Ne moreš takoj klepetati.** Prvič, ko odpreš ZEUS tab, te vodi skozi **klik-funnel** (cilj → nivo →
   faza sezone → oprema → dnevi → trajanje → poškodbe). Šele ko poda podatke, se **odklene chat**.
2. **Memory baza, ki se stalno uči.** Odgovori funnela + povratne informacije s treningov + dejstva, ki
   jih ZEUS izve med pogovorom, se shranijo v `coach_memory`. Agent jih vrine v **vsak** pogovor in z njimi
   raste — vrača se te pozna ("Spet tukaj, … nadaljujeva s ciljem …").

Vse v obstoječem **Hellenic dizajnu** (marmor + Aegean blue + zlato, Cinzel/Marcellus). Deluje tudi brez
backenda (demo način, localStorage); z žvimi odgovori, ko priklopiš Supabase + AI ključ.

---

## Kaj se je spremenilo

| Datoteka | Sprememba |
|---|---|
| `src/screens/ZeusFunnel.jsx` | **NOVO** — klik-funnel, ki gejta chat (7 korakov, theme.js slog) |
| `src/screens/ScreenAI.jsx` | prenovljen — gate (funnel↔chat), pozdrav iz spomina, feedback kartica, memory v `askAI` |
| `src/lib/api.js` | `loadCoachMemory` / `saveCoachMemory` / `saveCoachFeedback` / `addCoachNote` / `parseCoachReply`; `askAI` zdaj pošlje `memory` in si zapomni `[[NOTE]]` |
| `supabase/functions/ai-coach/index.ts` | `buildSystem()` vrine cel spomin + učna pravila (progresija, izogibanje poškodbam) — za Claude IN Gemini |
| `supabase/schema.sql` | nova tabela `coach_memory` (jsonb, RLS na uporabnika, idempotentno) |

**Učenje:** agent na konec odgovora doda `[[NOTE: kratko dejstvo]]` ko izve nekaj trajnega; aplikacija
oznako skrije pred športnikom in jo doda v `coach_memory.notes` → naslednjič jo agent že pozna.

---

## Deploy (da zaživi pravi AI s spominom)

Aplikacija **že deluje** brez tega (demo odgovori). Za žive, memory-aware odgovore:

1. **Baza:** v Supabase → SQL Editor zaženi celoten `supabase/schema.sql` (idempotenten — varno večkrat).
   Doda tabelo `coach_memory`.
2. **Edge funkcija:** Supabase → Edge Functions → funkcija `ai-coach` → prilepi novo vsebino iz
   `supabase/functions/ai-coach/index.ts` → Deploy.
3. **AI ključ (brezplačno):** Supabase → Edge Functions → Secrets → dodaj `GEMINI_API_KEY`
   (zastonj na https://aistudio.google.com → Get API key). Lahko dodaš tudi `ANTHROPIC_API_KEY` (Claude,
   plačljivo) — funkcija najprej poskusi Claude, sicer Gemini.
4. **Frontend ključi:** kot v `BACKEND_SETUP.md` (`.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

Brez koraka 2–3 chat še vedno dela z demo odgovori; spomin (funnel + feedback) deluje lokalno tudi brez
Supabase.

---

## Kako testirati lokalno (demo)

`npm run dev` → prijava z demo računom (e-pošta začne z `athlos@`, geslo `123`) → dokončaj profil →
zavihek **AI** → ZEUS te vodi skozi funnel → chat se odklene; ob vrnitvi te pozna + ponudi "Kako je šlo
zadnjič?". Vse se shrani v `localStorage` (`athlos:v1` → `coachMemory`).

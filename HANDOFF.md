# ATHLOS — ZEUS učeči se AI trener · Predaja ekipi

**Kaj je narejeno:** AI Coach v aplikaciji ATHLOS ("ZEUS" zavihek) je nadgrajen iz navadnega chatbota v
**učečega se agenta z memory bazo**. Vgrajeno v obstoječo app (React 19 + Vite + Supabase), v obstoječem
"Hellenic" dizajnu. **Deployano in deluje v živo** (Supabase + brezplačni Google Gemini).

---

## 1. Kaj dela (uporabniški tok)

1. **Gate (ne moreš takoj klepetati):** prvič ko športnik odpre **ZEUS** zavihek, ga vodi skozi
   klik-funnel (7 korakov): **cilj · nivo · faza sezone · oprema · dnevi/teden · trajanje · poškodbe**.
   Šele ko poda podatke, se **odklene chat**.
2. **Memory baza:** odgovori funnela se shranijo v tabelo `coach_memory`. Agent jih vrine v **vsak**
   pogovor → ZEUS te "pozna" ("Aktiviran… poznam tvoj cilj X, nivo Y…").
3. **Učenje skozi čas:**
   - **Feedback zanka:** ob vrnitvi ZEUS vpraša *"Kako je šlo zadnjič?"* (RPE 1–10 / opravljeno / bolečina)
     → shrani v spomin → naslednji trening je nadgradnja (progresija, izogibanje bolečim predelom).
   - **Naučene opombe:** ko AI izve trajno dejstvo o športniku, ga tiho zapiše (`[[NOTE: …]]`, skrito pred
     uporabnikom) v `coach_memory.notes` → naslednjič ga že pozna.
4. **Pravi AI:** odgovori prek Supabase Edge Function → **Google Gemini 2.5 Flash (brezplačno, ~1500/dan)**.
   Polni, personalizirani treningi v slovenščini, ki upoštevajo cilj, opremo, dni in poškodbe.
5. **Shrani v Koledar:** ko ZEUS poda tedenski plan, se pod njim pojavi gumb **"📅 Shrani teden v Koledar"** →
   ustvari treninge v tabeli `season_events` za prihodnji teden (dnevi + fokus iz spomina) → vidni v zavihku **Koledar**.

> Brez backenda app še vedno dela (demo način, localStorage + pameten offline trener, ki tudi uporablja
> spomin). Z backendom samodejno preklopi na pravi AI.

---

## 2. Kako je narejeno (arhitektura)

```
Frontend (React)                         Backend (Supabase)
─────────────────                        ──────────────────
ScreenAI.jsx  ── gate: funnel ↔ chat
   │  loadCoachMemory / saveCoachMemory
   │  askAI(profileId, msg, history,     ──►  Edge Function "ai-coach"
   │        profile, MEMORY)                    buildSystem(profile, memory)  ← vrine spomin
   ▼                                            └─► Gemini (ali Claude, če dodan ključ)
ZeusFunnel.jsx (klik onboarding)
coachOffline.js (offline fallback)       Postgres tabele (RLS per uporabnik):
lib/api.js (data sloj, demo↔cloud)         profiles · season_events · workouts
                                            ai_messages · coach_memory (jsonb: setup/notes/feedback)
```

- Vsa data logika je v **`src/lib/api.js`** — app se nikoli ne pogovarja s Supabase direktno.
- `coach_memory.data` (jsonb): `{ setup:{goal,level,seasonPhase,equipment[],daysPerWeek,sessionMinutes,injuries[]}, notes[], feedback[] }`.
- AI ključi so **samo** v Supabase Edge Secrets (nikoli v frontend bundlu).

### Nove / spremenjene datoteke
| Datoteka | |
|---|---|
| `src/screens/ZeusFunnel.jsx` | **NOVO** — klik-funnel, ki gejta chat |
| `src/lib/coachOffline.js` | **NOVO** — memory-aware offline trener + `planSessions()` (za Koledar) |
| `src/screens/ScreenAI.jsx` | gate + pozdrav iz spomina + feedback kartica + memory v `askAI` + **"Shrani v Koledar"** |
| `src/lib/api.js` | `loadCoachMemory`/`saveCoachMemory`/`saveCoachFeedback`/`addCoachNote`/`parseCoachReply` |
| `supabase/functions/ai-coach/index.ts` | `buildSystem` vrine spomin + učna pravila (Claude IN Gemini) |
| `supabase/schema.sql` | nova tabela `coach_memory` (RLS, idempotentno) |
| `COACH_AGENT.md` | tehnična deploy navodila |

---

## 3. Deploy (za novo okolje / drug Supabase projekt)

> Trenutno je že deployano na Ianovem Supabase projektu (`fuhmndzrjzwhfbcmfaii`) in deluje. Spodaj za
> ponovitev na drugem okolju.

**Supabase:**
1. **Baza:** SQL Editor → zaženi cel `supabase/schema.sql` (idempotenten).
2. **Edge Function:** Edge Functions → nova funkcija z imenom **točno `ai-coach`** → prilepi
   `supabase/functions/ai-coach/index.ts` → Deploy.
3. **Secrets:** Edge Functions → Secrets → dodaj **`GEMINI_API_KEY`** (brezplačno na
   https://aistudio.google.com). (Opcijsko `ANTHROPIC_API_KEY` za Claude.)
4. **Verify JWT:** na funkciji `ai-coach` **izklopi** "Verify JWT" (sicer zavrne klice z novim sistemom ključev).
5. **Auth:** (priporočeno za začetek) Authentication → Email → izklopi "Confirm email".

**Frontend (`.env` / Netlify env vars):**
```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…        # NOVI "publishable" ključ, NE legacy anon
```
> ⚠️ Projekti na **novem sistemu ključev** rabijo **publishable** ključ (`sb_publishable_…`) — legacy
> `anon` JWT Edge Functions zavrnejo. Najdeš ga v Project Settings → API Keys → "Publishable and secret".

---

## 4. Test / kako preveriš da dela

- **V app-u:** Registracija → izpolni profil → zavihek **ZEUS** → funnel → klepetaj. Odgovori naj
  upoštevajo tvoj cilj + poškodbe; ob vrnitvi te pozdravi po imenu + ponudi feedback.
- **Direktno (curl), preverjeno:** klic na `…/functions/v1/ai-coach` z memory vrne poln slovenski plan,
  ki se prilagaja (npr. Moč+koleno vs Eksplozivnost+rama dasta različna pravilna odgovora). `provider: gemini`.

---

## 5. Varnost
- RLS: vsak uporabnik vidi/ureja **samo svoje** podatke (vse tabele).
- AI ključi: **samo** v Supabase Edge Secrets (nikoli `VITE_`, nikoli v repo/Netlify).
- `publishable` ključ je javen (gre v browser) — zaščita je RLS. `service_role` ključ NIKOLI ne deli /
  ne daj v frontend.

## 6. Možne nadgradnje (predlogi)
- Da feedback/ spomin vpliva tudi na "AI urnik" generator v Koledarju (ScreenSeason).
- Da ZEUS v chatu generira strukturiran tedenski plan, ki se shrani v `season_events`.
- Rate-limiting na Edge Function (proti zlorabi brezplačne Gemini kvote) + ponovni vklop Verify JWT.

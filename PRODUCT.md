# ATHLOS — Product Context

## What it is
Mobile-first web app (PWA) for athletes: "the system that knows every athlete."
Readiness battery, AI coach (ZEUS), training sessions, season calendar, nutrition,
club/team views for coaches. Slovenian-first UI with EN toggle.

## Register
`product` — app UI; design serves the product. But the brand identity is strong
and deliberate: Greco-Roman "marble" aesthetic (see DESIGN notes below).

## Users
Young competitive athletes (football, basketball, individual sports) and their
coaches. Used daily on phones — morning check-in, workout logging, chat with coach.

## Design system (committed — identity preservation wins)
Source of truth: `src/theme.js` (tokens) + `src/athlos-marble.css` + the portable
`athlos-design-system` kit. Reference mock: marble home with ΑΘΛΟΣ wordmark,
bronze medallion (8.4 PARATUS READINESS), engraved section rules.

- Surfaces: warm marble `#FAF7F0`/`#FCF9F2`, vein borders `rgba(28,24,20,0.12)`
- Ink: `#1C1814`; muted via ink transparencies
- Accents: bronze `#B08D57`, gold `#C8A24A`, laurel `#1F7A52`; electric green
  `#00FF87` is a SIGNAL only (active nav, one arrow, AI halos) — never a fill
- Type: Cinzel (engraved UPPERCASE headings, tracked), Cormorant Garamond
  (body/quotes, italics welcome), Barlow Condensed (big display labels),
  JetBrains Mono (data/kickers, uppercase, wide tracking)
- Dark "oracle" panels (near-black `#14120E`, green halo) are reserved for the
  AI/coach voice and live-training surfaces
- Radii 14–24px; soft lifted shadows; `.at-flute` fluted-column texture accent
- Dark theme exists ("Olympian forest") but light marble is the brand default

## Conventions
- All styling is inline styles driven by the theme context `C` (useTheme) —
  no Tailwind, no CSS modules. Reusable bits in `src/components/UI.jsx`
  (Mono = uppercase mono kicker, Accent, PrimaryBtn, Pressable).
- i18n: `t("slovenski niz")` → EN map in `src/lib/i18n.js`.
- Data goes through `src/lib/api.js` (demo localStorage ↔ Supabase).

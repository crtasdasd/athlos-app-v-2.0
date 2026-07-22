import React from "react";

// ─────────────────────────────────────────────────────────────
// ATHLOS — "Marble" (Greco-Roman) theme.
// Warm marble surfaces, bronze/gold ornament, ink-black text, with
// the brand's electric green (#00FF87) kept as a sparing signal —
// bold on dark "oracle" panels (ZEUS / AI), restrained as classical
// laurel green on light marble. Cinzel (engraved caps) for headings,
// Cormorant Garamond for body/quotes/numerals, Barlow Condensed for
// big display labels, JetBrains Mono for data.
// ─────────────────────────────────────────────────────────────

export const FONTS = {
  // body / UI
  display: "'Poppins',system-ui,sans-serif",
  // headings — same face, heavier weights differentiate
  heading: "'Poppins',system-ui,sans-serif",
  // accent / numerals / quotes
  serif: "'Poppins',system-ui,sans-serif",
  // display labels
  cond: "'Poppins',system-ui,sans-serif",
  // data / numerals — monospace kept for data fidelity
  mono: "'JetBrains Mono','IBM Plex Mono',ui-monospace,Menlo,monospace",
};

export const THEMES = {
  // ── DARK — premium 2025: near-black canvas, solid grayscale surfaces for
  // depth (no glows, no colour washes), electric green reserved for primary
  // actions and key signals only ──
  dark: {
    name: "dark",
    bg: "#080808",
    bgImage: "none",
    // primary action IS the brand green — the one element allowed to shine
    btn: "#00FF87",
    btnText: "#04130A",
    surface: "#111111",
    surface2: "#181818",
    surface3: "#1F1F1F",
    border: "rgba(255,255,255,0.06)",
    border2: "rgba(255,255,255,0.10)",
    text: "#FFFFFF",
    text2: "#B3B3B3",
    muted: "#8C8C8C",
    muted2: "#5C5C5C",
    accent: "#00FF87",
    accent2: "#33FFA3",
    gold: "#33FFA3",
    gold2: "#00FF87",
    red: "#F87066",
    yellow: "#F5A623",
    // metric accents — used sparingly, always with an icon + label
    amber: "#F5A623",
    aqua: "#4CC9F0",
    lav: "#C9A7FF",
    lime: "#D9FF5B",
    // restrained: only the green CTA may glow, and only softly
    glow: "0 8px 24px rgba(0,255,135,0.22)",
    glowSoft: "0 6px 16px rgba(0,255,135,0.14)",
    ambient: "rgba(0,255,135,0.07)",
    grid: "rgba(0,255,135,0.03)",
    ...FONTS,
  },

  // ── LIGHT (default) — "Clean studio": a cool, calm neutral system built
  // AROUND the Athlos green rather than a warm cream that reads dated. The
  // canvas is a soft cool gray so crisp white cards lift off it (depth from
  // tone, not heavy shadow — Linear / Stripe / Notion). Text is a cool ink,
  // not pure black. Green stays the one brand signal: a deepened emerald that
  // clears AA on white for text/icons, plus an electric pop for tiny accents.
  light: {
    name: "light",
    // app canvas — cool light gray; white surfaces sit visibly above it
    bg: "#F5F6F8",
    bgImage: "none",
    // primary CTA — Athlos green, deepened just enough for white text (AA ~5:1)
    btn: "#12805A",
    btnText: "#FFFFFF",
    surface: "#FFFFFF",   // elevated cards — the one true white
    surface2: "#EFF1F4",  // inset controls: inputs, tiles, segmented tracks
    surface3: "#E3E7EC",  // deepest inset: progress tracks, skeletons
    // cool slate-based hairlines — quiet structure without hard lines
    border: "rgba(16,24,40,0.08)",
    border2: "rgba(16,24,40,0.12)",
    // cool near-black ink → strong slate → gray labels → faint gray
    text: "#0F1729",
    text2: "#3A4453",
    muted: "#68727F",
    muted2: "#98A2B0",
    // brand green for text/icons/active states — AA-legible on white
    accent: "#12805A",
    // electric pop reserved for tiny non-text accents (dots, sparkles)
    accent2: "#00E27E",
    gold: "#12805A",
    gold2: "#00E27E",
    // semantic set — clean, confident, all AA on white
    red: "#D0352B",
    yellow: "#B5610A",
    // metric accents — burnt amber / deep teal / violet / olive
    amber: "#B5610A",
    aqua: "#0E7490",
    lav: "#6941C6",
    lime: "#5B8C00",
    // the ONLY glow — a soft green lift under the primary CTA
    glow: "0 10px 30px rgba(18,128,90,0.20)",
    glowSoft: "0 6px 18px rgba(18,128,90,0.13)",
    ambient: "rgba(18,128,90,0.08)",
    grid: "rgba(16,24,40,0.04)",
    ...FONTS,
  },
};

export const ThemeContext = React.createContext(THEMES.light);
export const useTheme = () => React.useContext(ThemeContext);

export const DatePickerContext = React.createContext(null);
export const useDatePicker = () => React.useContext(DatePickerContext);

export const TimePickerContext = React.createContext(null);
export const useTimePicker = () => React.useContext(TimePickerContext);

// Wordmark/emblem now drawn as a themed SVG (Greek column + lightning),
// so we drop the old raster logo and let the SVG fallback render.
export const LOGO = "";

export const LANDING_URL = "https://athl-os.com/";

import React, { useState } from "react";
import { useTheme } from "../theme";

/* Count-up kept as a no-op for API compatibility — minimal UI shows final value directly. */
export function useCountUp(target) {
  return target;
}

export function Pressable({ children, onClick, style, scale = 0.98, disabled, className, ...rest }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        cursor: disabled ? "default" : "pointer",
        transition: "transform 0.12s ease, opacity 0.12s",
        // transform is only set inline while actively pressed — resting/hover
        // transforms (e.g. .at-card-hover's lift) come from CSS, and inline
        // style always wins over a stylesheet rule, so this can't stay
        // unconditionally "scale(1)" or the CSS hover lift would be dead code.
        ...(pressed ? { transform: `scale(${scale})` } : {}),
        WebkitTapHighlightColor: "transparent",
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// Pulsing placeholder — used everywhere something is loading, so a slow
// network/query reads as "in progress" rather than a blank flash.
export function SkeletonBlock({ width = "100%", height = 16, radius = 8, style }) {
  const C = useTheme();
  return (
    <div className="athlos-skeleton" style={{
      width, height, borderRadius: radius,
      background: C.surface3,
      ...style,
    }} />
  );
}

// Design-system ".at-mono"/".at-eyebrow": data + kickers in JetBrains Mono,
// UPPERCASE with wide tracking — the engraved look from the reference mock.
export const Mono = ({ children, style }) => {
  const C = useTheme();
  return (
    <span style={{ fontFamily: C.mono, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10, fontWeight: 600, ...style }}>
      {children}
    </span>
  );
};

// Accent word — the signature: an elegant italic serif word in neon green,
// used for ONE word inside a headline ("Dobro jutro, <Accent>Nik</Accent>")
export const Accent = ({ children, style }) => {
  const C = useTheme();
  return (
    <span style={{ fontFamily: C.serif, fontStyle: "italic", fontWeight: 500, fontSize: "1.18em", color: C.gold, letterSpacing: "0.01em", ...style }}>
      {children}
    </span>
  );
};

// ── Hellenic emblem — laurel wreath of victory + Zeus' thunderbolt ──
export const Emblem = ({ size = 40, glow = false }) => {
  const C = useTheme();
  const g = C.gold, a = C.accent;
  const leaf = (x, y, rot, s = 1) => (
    <path
      d={`M${x} ${y} q ${5 * s} ${-2.4 * s} ${7.6 * s} ${1.2 * s} q ${-3.8 * s} ${1.6 * s} ${-7.6 * s} ${-1.2 * s} z`}
      fill={g} opacity="0.92" transform={`rotate(${rot} ${x} ${y})`}
    />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      style={glow ? { filter: `drop-shadow(0 0 12px ${a}55)` } : undefined}>
      {/* left laurel branch */}
      <path d="M31 55 C19 50 13.5 39.5 16.5 26" stroke={g} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.95" />
      {leaf(19.5, 45, 120)}{leaf(16.6, 38, 150)}{leaf(15.8, 31, 175)}{leaf(17.4, 25, 205)}
      {/* right laurel branch (mirror) */}
      <path d="M33 55 C45 50 50.5 39.5 47.5 26" stroke={g} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.95" />
      {leaf(44.5, 45, 60)}{leaf(47.4, 38, 30)}{leaf(48.2, 31, 5)}{leaf(46.6, 25, -25)}
      {/* Zeus' thunderbolt */}
      <path d="M35.5 11 L25 33 H31.5 L29 51 L40.5 28 H34 L36.5 11 Z"
        fill={a} stroke={a} strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
};

// ── Wordmark — inscriptional Cinzel caps, gold "OS" (the one place the
// engraved brand face survives the app-wide Poppins switch) ──
export const Wordmark = ({ size = 30, style }) => {
  const C = useTheme();
  return (
    <span style={{ fontFamily: "'Cinzel',Georgia,serif", fontWeight: 700, fontSize: size, letterSpacing: "0.18em", color: C.text, ...style }}>
      ATHL<span style={{ color: C.gold }}>OS</span>
    </span>
  );
};

export const Kicker = ({ children, color }) => {
  const C = useTheme();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontFamily: C.display, fontSize: 12, letterSpacing: "0.02em", textTransform: "lowercase",
      color: color || C.muted, fontWeight: 500, marginBottom: 5,
    }}>
      <span aria-hidden="true" style={{
        width: 5, height: 5, borderRadius: "50%", background: C.accent, flexShrink: 0,
      }} />
      {children}
    </div>
  );
};

export const Pill = ({ children, fill, color }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <span style={{
      fontFamily: C.display, fontSize: 11.5, letterSpacing: "0.01em", textTransform: "lowercase",
      padding: "3px 9px", borderRadius: 999, fontWeight: 600,
      color: fill ? "#000" : c, background: fill ? c : `${c}16`,
      border: "none",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
};

// Small in-row action pill with an active/inactive state (Follow/Following,
// Join/Joined, …) — built on Pressable so it gets the same press-scale
// feedback as everything else without depending on any screen-local CSS
// class. One shared primitive instead of the same pill hand-rolled per
// screen with slightly different values each time.
export function ToggleChip({ active, onClick, icon, label, activeIcon, activeLabel, style }) {
  const C = useTheme();
  return (
    <Pressable onClick={onClick} scale={0.94} style={{
      flexShrink: 0, display: "flex", alignItems: "center", gap: 5, borderRadius: 999,
      padding: "7px 13px", fontFamily: C.display, fontWeight: 700, fontSize: 11.5,
      background: active ? "transparent" : C.accent, color: active ? C.muted : C.btnText,
      boxShadow: active ? "none" : `0 4px 14px ${C.accent}30`,
      outline: active ? `1px solid ${C.border2}` : "none",
      transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
      ...style,
    }}>
      {active ? activeIcon : icon}
      {active ? activeLabel : label}
    </Pressable>
  );
}

export function LanguageSwitcher({ value = "sl", onChange, style, variant = "default" }) {
  const C = useTheme();
  const cur = value === "en" ? "en" : "sl";
  const floating = variant === "floating";
  const compact = variant === "compact"; // small pill for tight headers (e.g. onboarding)
  const options = [
    ["sl", "SL", "Slovenščina", "Slovenian"],
    ["en", "EN", "English", "English"],
  ];

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: floating || compact ? 3 : 4,
        padding: floating || compact ? 3 : 4,
        borderRadius: 999,
        background: floating
          ? (C.name === "dark" ? "rgba(8,11,10,0.72)" : "rgba(255,255,255,0.72)")
          : C.surface2,
        border: `1px solid ${floating ? (C.name === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)") : C.border2}`,
        boxShadow: floating ? (C.name === "dark" ? "0 6px 16px rgba(0,0,0,0.35)" : "0 6px 16px rgba(28,24,20,0.12)") : "none",
        backdropFilter: floating ? "blur(18px)" : undefined,
        WebkitBackdropFilter: floating ? "blur(18px)" : undefined,
        minHeight: floating ? 38 : compact ? 30 : 44,
        ...style,
      }}
    >
      {options.map(([code, short, label, title]) => {
        const active = cur === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            aria-label={title}
            title={title}
            onClick={() => onChange?.(code)}
            style={{
              minWidth: floating ? 42 : compact ? 34 : 54,
              minHeight: floating ? 32 : compact ? 24 : 36,
              padding: floating ? "0 10px" : compact ? "0 8px" : "0 12px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: active ? (floating ? C.accent : C.btn) : "transparent",
              color: active ? (floating ? "#04130a" : C.btnText) : C.muted,
              fontFamily: C.display,
              fontWeight: active ? 800 : 700,
              fontSize: floating ? 11 : compact ? 10.5 : 12,
              letterSpacing: "0.04em",
              boxShadow: active && floating ? `0 0 0 1px ${C.accent}30` : "none",
              transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

export const PrimaryBtn = ({ children, onClick, style, disabled }) => {
  const C = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="at-btn-primary"
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: "100%", height: 47, padding: "0 14px", borderRadius: 15, border: "none",
        background: C.btn, color: C.btnText,
        fontFamily: C.display, fontWeight: 700, textTransform: "none",
        letterSpacing: "0.01em", fontSize: 15,
        cursor: disabled ? "default" : "pointer",
        // the ONE element allowed a soft glow — the brand-green CTA
        boxShadow: pressed ? "none" : C.glowSoft,
        WebkitTapHighlightColor: "transparent",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
        // only set inline while pressed — resting/hover comes from
        // .at-btn-primary in index.css (inline style otherwise wins and the
        // CSS hover-lift would never get a chance to apply)
        ...(pressed ? { transform: "scale(0.98)" } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
};

export const BackBtn = ({ onClick }) => {
  const C = useTheme();
  return (
    <Pressable onClick={onClick} scale={0.88} style={{
      background: "transparent", border: `1px solid ${C.border}`, borderRadius: 50,
      width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
      color: C.text, marginRight: 10, lineHeight: 1, flexShrink: 0,
    }}>
      <svg width="8" height="14" viewBox="0 0 10 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 1L1 9l8 8"/>
      </svg>
    </Pressable>
  );
};

export const Icon = ({ name, color, size = 19 }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "today":    return (<svg {...common}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>);
    case "train":    return (<svg {...common}><path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/></svg>);
    case "fuel":     return (<svg {...common}><path d="M6 3v7a2 2 0 004 0V3M8 11v10M18 3c-1.5 0-3 1.5-3 5s1.5 4 3 4v9"/></svg>);
    // AI wears the ATHLOS mark — the arrow-A: an "A" with its left leg sliced
    // by an arrow that shoots up-left. Brand green unless a colour is passed.
    case "ai": {
      const g = color || "#00FF87";
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          {/* apex + right leg (left side cut off by the arrow shaft) */}
          <path d="M12.6 2.2 L9.43 9.56 L11.69 10.91 L12.6 8.8 L15.3 15 L18 15 Z" fill={g} />
          {/* lower fragment of the left leg, below the shaft */}
          <path d="M8.82 10.99 L11.07 12.35 L7.78 20 L4.95 20 Z" fill={g} />
          {/* arrow shaft — razor taper toward the bottom-right tail */}
          <path d="M23.2 18.7 L5.5 7.2 L5.5 9.0 Z" fill={g} />
          {/* barbed arrowhead, pointing up-left */}
          <path d="M1.6 5.1 L7.2 4.3 L5.9 6.9 L5.3 9.9 Z" fill={g} />
        </svg>
      );
    }
    case "season":   return (<svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>);
    case "settings": return (<svg {...common}><circle cx="12" cy="8" r="3.2"/><path d="M6 20v-1a6 6 0 0112 0v1"/></svg>);
    case "calendar": return (<svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>);
    case "chat":     return (<svg {...common}><path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 01-.9-3.8A8.38 8.38 0 0112.5 3 8.38 8.38 0 0121 11.5z"/></svg>);
    case "club":     return (<svg {...common}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/></svg>);
    case "profile":  return (<svg {...common}><circle cx="12" cy="8" r="3.6"/><path d="M5 20v-1a7 7 0 0114 0v1"/></svg>);
    default: return null;
  }
};

// Icon-only tab: the active one is a solid accent circle with a knocked-out
// icon, inactive ones are bare muted glyphs — the compact floating-pill look.
// `dot` marks the tab with a small badge (e.g. unread chat messages).
export function TabButton({ n, active, onClick, dot }) {
  const C = useTheme();
  const dark = C.name === "dark";
  return (
    <button
      onClick={onClick}
      aria-label={n.label}
      className="athlos-tab-btn"
      style={{
        flex: "0 0 auto", width: active ? "auto" : 44, height: 44, borderRadius: 999,
        padding: active ? "0 14px" : 0,
        border: "none", cursor: "pointer", position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? C.accent : "transparent",
        boxShadow: "none",
        WebkitTapHighlightColor: "transparent",
        transition: "background 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      {/* active tab spells its name; the icon only stands in while inactive */}
      {active
        ? <span style={{ fontFamily: C.display, fontWeight: 700, fontSize: 12.5, color: dark ? "#04130A" : "#FFFFFF", whiteSpace: "nowrap", lineHeight: 1 }}>{n.label}</span>
        : <Icon name={n.icon} color={C.muted} size={19} />}
      {dot && <span aria-hidden="true" style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: C.red, border: active ? `1.5px solid ${C.accent}` : "none" }} />}
      <style>{`
        .athlos-tab-btn { transition: transform 0.15s ease; }
        .athlos-tab-btn:active { transform: scale(0.86); }
      `}</style>
    </button>
  );
}

export function SettingsBlock({ title, children }) {
  const C = useTheme();
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
      <Mono style={{ color: C.muted, fontSize: 10, display: "block", marginBottom: 9 }}>{title}</Mono>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Design-system primitives — the premium dark language used across
// every screen. Soft dark card, no border, 24px radius, one green
// accent, quiet shadow. Keep new screens built from THESE, so the
// whole app stays visually consistent.
// ─────────────────────────────────────────────────────────────

// Soft dark surface card. Pass onClick to make it a pressable row.
// Glass-like: an extremely soft top sheen + hairline over the flat fill gives
// premium depth without any obvious gradient.
export function Card({ children, onClick, style, pad = 16, radius = 18, ...rest }) {
  const C = useTheme();
  const dark = C.name === "dark";
  const base = {
    background: dark
      ? `linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0) 44%), ${C.surface2}`
      : `linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), ${C.surface2}`,
    borderRadius: radius, padding: pad,
    border: `1px solid ${dark ? "rgba(255,255,255,0.045)" : "rgba(16,24,40,0.05)"}`,
    boxShadow: dark
      ? "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
      : "0 2px 12px rgba(16,24,40,0.05)",
    ...style,
  };
  return onClick
    ? <Pressable onClick={onClick} scale={0.99} className="at-card-hover" style={{ ...base, width: "100%", textAlign: "left", display: "block" }} {...rest}>{children}</Pressable>
    : <div style={base} {...rest}>{children}</div>;
}

// Small uppercase section header with an optional right-aligned action.
export function SectionLabel({ children, action, onAction, style }) {
  const C = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, ...style }}>
      <span style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, fontWeight: 600 }}>{children}</span>
      {action && (
        <button onClick={onAction} style={{ background: "none", border: "none", color: C.accent, fontFamily: C.display, fontWeight: 600, fontSize: 12, cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent" }}>{action}</button>
      )}
    </div>
  );
}

// ── MetricCard — an icon-led health metric (Sleep, Recovery, Fatigue, Mood).
//
// Distinct from StatTile below, which is the label-led tile used for tabular
// stats: this one leads with a glyph and puts the NUMBER first in the reading
// order, with the label demoted to a caption underneath it.
//
// That inversion is the whole point. Label-above-value is the generic
// dashboard order — you read a caption, then hunt for the figure. Every app
// this is meant to sit beside (WHOOP, Oura, Apple Health) puts the figure
// first and uses the label to confirm what you just read. Combined with a
// left-aligned column and the icon pinned top-left, the card scans in one
// downward sweep instead of radiating from a centre point.
//
// Colour is deliberately scarce: the glyph is a soft neutral, and `accent`
// turns exactly one card green. Surface, border and shadow are copied from
// Card so these are visibly the same material as every other card in the app.
export function MetricCard({ icon: Glyph, label, value, unit, accent = false, onClick, style }) {
  const C = useTheme();
  const dark = C.name === "dark";
  const has = value != null;
  return (
    <Pressable
      onClick={onClick}
      scale={0.98}
      className="at-metric-card"
      aria-label={label}
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch",
        width: "100%", minWidth: 0, minHeight: 98,
        padding: "12px 12px 13px", borderRadius: 18, textAlign: "left",
        background: dark
          ? "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0) 44%), #181818"
          : "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%), #FFFFFF",
        border: `1px solid ${dark ? "rgba(255,255,255,0.045)" : "rgba(16,24,40,0.05)"}`,
        boxShadow: dark
          ? "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
          : "0 2px 12px rgba(16,24,40,0.05)",
        "--at-hover-border": dark ? "rgba(255,255,255,0.14)" : "rgba(16,24,40,0.13)",
        "--at-hover-shadow": dark
          ? "0 2px 4px rgba(0,0,0,0.42), 0 14px 30px rgba(0,0,0,0.32)"
          : "0 2px 4px rgba(16,24,40,0.05), 0 14px 28px rgba(16,24,40,0.10)",
        // Declared here, not in the stylesheet: Pressable writes `transition`
        // inline and an inline rule always wins, so border-color and shadow
        // would otherwise never animate.
        transition: "transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s cubic-bezier(0.22,1,0.36,1), border-color 0.3s ease, opacity 0.12s",
        ...style,
      }}
    >
      {/* Glyph sits low-contrast and top-left so it anchors the card without
          competing with the figure — an icon that outshines its own number is
          the thing that makes a tile read as a widget. */}
      <Glyph size={16} strokeWidth={1.8} color={accent ? C.accent : C.muted}
        style={{ flexShrink: 0, display: "block" }} />

      <span style={{ flex: 1, minHeight: 14 }} />

      {/* value — the focus. `key` restarts the entrance whenever the number
          changes, so a check-in submit updates it with a soft rise instead of
          a hard swap. */}
      <span style={{ display: "flex", alignItems: "baseline", gap: 2, minWidth: 0 }}>
        <span key={String(value)} style={{
          fontFamily: C.display, fontWeight: 700, fontSize: "clamp(18px, 5.6vw, 24px)",
          lineHeight: 1, letterSpacing: "-0.035em", color: has ? C.text : C.muted2,
          animation: "athlosMetricIn 0.34s cubic-bezier(0.22,1,0.36,1)",
        }}>{has ? value : "—"}</span>
        {has && unit && (
          <span style={{
            fontFamily: C.display, fontWeight: 500, fontSize: 11,
            color: C.muted2, letterSpacing: "-0.01em",
          }}>{unit}</span>
        )}
      </span>

      {/* label — demoted to a caption under the figure */}
      <span style={{
        display: "block", marginTop: 6,
        fontFamily: C.mono, fontSize: 8, fontWeight: 600, letterSpacing: "0.11em",
        textTransform: "uppercase", color: C.muted2,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{label}</span>
    </Pressable>
  );
}

// Compact metric tile — label · value · optional sub · optional level bar.
// The single building block for stat grids and metric rows everywhere.
export function StatTile({ label, value, sub, onClick, barPct, color, valueColor, style }) {
  const C = useTheme();
  const inner = (
    <>
      <span style={{ display: "block", fontFamily: C.mono, fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted2, marginBottom: 7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ display: "block", fontFamily: C.display, fontWeight: 800, fontSize: 17, color: valueColor || C.text, lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</span>
      {sub && <span style={{ display: "block", fontFamily: C.display, fontWeight: 500, fontSize: 10.5, color: C.muted, marginTop: 4 }}>{sub}</span>}
      {typeof barPct === "number" && (
        <span style={{ display: "block", height: 4, borderRadius: 999, background: C.surface3, overflow: "hidden", marginTop: 8 }}>
          <span style={{ display: "block", width: `${Math.round(Math.max(0, Math.min(1, barPct)) * 100)}%`, height: "100%", borderRadius: 999, background: color || C.accent, transition: "width 0.7s cubic-bezier(.22,1,.36,1)" }} />
        </span>
      )}
    </>
  );
  const dark = C.name === "dark";
  const base = {
    background: dark
      ? `linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0) 46%), ${C.surface2}`
      : `linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 44%), ${C.surface2}`,
    borderRadius: 16, padding: "11px 12px", textAlign: "left",
    border: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(16,24,40,0.045)"}`,
    boxShadow: dark ? "inset 0 1px 0 rgba(255,255,255,0.025)" : "0 1px 6px rgba(16,24,40,0.04)",
    ...style,
  };
  return onClick
    ? <Pressable onClick={onClick} scale={0.98} className="at-card-hover" style={{ ...base, width: "100%", display: "block" }}>{inner}</Pressable>
    : <div style={base}>{inner}</div>;
}

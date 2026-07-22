import { useState, useRef } from "react";
import { useTheme } from "../theme";

// ─────────────────────────────────────────────────────────────
// NOTIFICATION INBOX
//
// Built by subtraction. Everything that survived has a job:
//
//   bell      one glyph for every row. Per-type icons looked like variety
//             but carried nothing — you already know what a row is from its
//             title, so the icon was decoration wearing a semantic costume.
//   title     the only bold thing on screen.
//   body      one line, truncated. A list is scanned, not read.
//   time      the quietest text in the app.
//   dot       present only when unread. The single state indicator.
//
// Everything else is gone: card shadows, the shared container, the coloured
// left rail, the icon chips, per-row text buttons, amber tones, chip counts.
// Actions are gestures, which cost no pixels: swipe left dismisses, swipe
// right marks read, tap opens.
// ─────────────────────────────────────────────────────────────

const Bell = ({ size = 16, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 01-3.4 0" />
  </svg>
);

// Relative time, coarse on purpose: "2 h" is what you want to know.
export function formatRelative(date, lang = "sl", now = new Date()) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(+d)) return "";
  const mins = Math.round((now - d) / 60000);
  const en = lang === "en";
  if (mins < 1) return en ? "now" : "zdaj";
  if (mins < 60) return en ? `${mins}m` : `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return en ? `${hrs}h` : `${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return en ? "yesterday" : "včeraj";
  if (days < 7) return en ? `${days}d` : `${days} dni`;
  return en ? `${Math.round(days / 7)}w` : `${Math.round(days / 7)} ted.`;
}

// ── Header ──
// Back arrow, title, count. The count is a plain green numeral beside the
// title, not a filled badge: a badge is a shape drawn around a number, and
// the number was already legible.
export function NotificationHeader({ title, unread, onBack, onMarkAll, markAllLabel, backLabel }) {
  const C = useTheme();
  return (
    <div>
      <button
        onClick={onBack}
        aria-label={backLabel}
        style={{
          width: 34, height: 34, marginLeft: -8, marginBottom: 12,
          background: "none", border: "none", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.muted, WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg width="10" height="16" viewBox="0 0 10 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1L1 9l8 8" /></svg>
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <h1 style={{
          margin: 0, fontFamily: C.display, fontWeight: 600, fontSize: 28,
          letterSpacing: "-0.035em", lineHeight: 1.1, color: C.text,
          display: "flex", alignItems: "baseline", gap: 9, minWidth: 0,
        }}>
          {title}
          {unread > 0 && (
            <span style={{
              fontFamily: C.display, fontWeight: 600, fontSize: 17,
              letterSpacing: "-0.02em", color: C.accent,
            }}>{unread}</span>
          )}
        </h1>
        {onMarkAll && unread > 0 && (
          <button onClick={onMarkAll} style={{
            padding: 0, background: "none", border: "none", cursor: "pointer", flexShrink: 0,
            fontFamily: C.display, fontWeight: 500, fontSize: 12.5, letterSpacing: "-0.01em",
            color: C.muted2, WebkitTapHighlightColor: "transparent",
          }}>{markAllLabel}</button>
        )}
      </div>
    </div>
  );
}

// ── Filters ──
// No counts: the header already states the unread number, and repeating it
// inside a chip is the same fact drawn twice. Inactive chips carry no fill at
// all, so only the selected one registers as a surface.
export function NotificationFilter({ options, value, onChange }) {
  const C = useTheme();
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            style={{
              padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              background: on ? `${C.accent}14` : "transparent",
              color: on ? C.accent : C.muted,
              fontFamily: C.display, fontWeight: on ? 600 : 500, fontSize: 13,
              letterSpacing: "-0.01em",
              transition: "background 0.32s cubic-bezier(0.22,1,0.36,1), color 0.26s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* reserves its bold width so selecting a chip can't shift its
                neighbours along the row */}
            <span className="at-chip-lbl" data-text={o.label}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const SWIPE_DECIDE = 8;   // px before an axis is committed to
const SWIPE_ARM = 62;     // px past which release fires the action
const SWIPE_MAX = 96;

// ── A row ──
export function NotificationRow({
  title, body, time, unread, leaving,
  onOpen, onMarkRead, onDismiss, markLabel, dismissLabel,
}) {
  const C = useTheme();
  const dark = C.name === "dark";
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const moved = useRef(false);

  const down = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, axis: null };
    moved.current = false;
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const ox = e.clientX - d.x, oy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(ox) < SWIPE_DECIDE && Math.abs(oy) < SWIPE_DECIDE) return;
      // Biased toward vertical: a list is scrolled far more often than swiped.
      d.axis = Math.abs(ox) > Math.abs(oy) * 1.4 ? "x" : "y";
      if (d.axis === "x") {
        setDragging(true);
        moved.current = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* best-effort */ }
      }
    }
    if (d.axis !== "x") return;
    let v = ox;
    if (v > 0 && !unread) v = 0;               // nothing to mark read
    setDx(Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, v)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d?.axis === "x") {
      if (dx <= -SWIPE_ARM) { setDx(0); onDismiss?.(); return; }
      if (dx >= SWIPE_ARM && unread) { setDx(0); onMarkRead?.(); return; }
    }
    setDx(0);
  };

  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 12,
      maxHeight: leaving ? 0 : 160,
      opacity: leaving ? 0 : 1,
      marginBottom: leaving ? 0 : 6,
      transition: leaving
        ? "max-height 0.34s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease, margin-bottom 0.34s cubic-bezier(0.4,0,0.2,1)"
        : "none",
    }}>
      {/* gesture reveals — text only, no icons, no coloured fills */}
      <span aria-hidden="true" style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 16px",
        fontFamily: C.display, fontWeight: 600, fontSize: 12, letterSpacing: "-0.01em",
      }}>
        <span style={{ color: C.accent, opacity: dx > 12 ? 1 : 0, transition: "opacity 0.16s ease" }}>{markLabel}</span>
        <span style={{ color: C.muted, opacity: dx < -12 ? 1 : 0, transition: "opacity 0.16s ease" }}>{dismissLabel}</span>
      </span>

      <div
        // App.jsx's global tab-swipe skips anything inside [data-noswipe];
        // without this, swiping a row would also page to the next tab.
        data-noswipe="true"
        role="button"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => { if (!moved.current) onOpen?.(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); } }}
        style={{
          position: "relative", zIndex: 1,
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "12px 14px", borderRadius: 12, cursor: "pointer", touchAction: "pan-y",
          background: dark ? "rgba(255,255,255,0.026)" : "rgba(16,24,40,0.022)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.045)" : "rgba(16,24,40,0.05)"}`,
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 0.42s cubic-bezier(0.22,1,0.36,1)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ flexShrink: 0, display: "flex", marginTop: 1 }}>
          <Bell size={16} color={C.accent} />
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{
              flex: 1, minWidth: 0,
              fontFamily: C.display, fontSize: 14.5, letterSpacing: "-0.02em",
              fontWeight: unread ? 600 : 500,
              color: unread ? C.text : C.text2,
              transition: "font-weight 0.3s ease, color 0.3s ease",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{title}</span>
            <span style={{
              fontFamily: C.mono, fontSize: 8.5, fontWeight: 500, letterSpacing: "0.05em",
              color: C.muted2, flexShrink: 0, whiteSpace: "nowrap",
            }}>{time}</span>
            {/* the one and only unread indicator */}
            <span aria-hidden="true" style={{
              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
              background: C.accent, opacity: unread ? 1 : 0,
              transition: "opacity 0.35s ease",
            }} />
          </span>
          <span style={{
            display: "block", marginTop: 3,
            fontFamily: C.display, fontWeight: 400, fontSize: 12.5, lineHeight: 1.35,
            color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{body}</span>
        </span>
      </div>
    </div>
  );
}

// ── Empty state ──
// A single outline bell, the same one the rows use, at rest. No ring around
// it: the circle was a container drawn to hold something that needed no
// holding.
export function NotificationsEmpty({ title, body, ctaLabel, onCta }) {
  const C = useTheme();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "72px 24px 40px",
    }}>
      <span style={{ opacity: 0.5, marginBottom: 20 }}><Bell size={30} color={C.muted} /></span>
      <h2 style={{
        margin: 0, fontFamily: C.display, fontWeight: 600, fontSize: 17,
        letterSpacing: "-0.025em", color: C.text,
      }}>{title}</h2>
      <p style={{
        margin: "7px 0 0", fontFamily: C.display, fontWeight: 400, fontSize: 13,
        lineHeight: 1.55, color: C.muted, maxWidth: "27ch",
      }}>{body}</p>
      {onCta && (
        <button onClick={onCta} style={{
          marginTop: 20, padding: 0, background: "none", border: "none", cursor: "pointer",
          fontFamily: C.display, fontWeight: 600, fontSize: 13.5, letterSpacing: "-0.01em",
          color: C.accent, WebkitTapHighlightColor: "transparent",
        }}>{ctaLabel}</button>
      )}
    </div>
  );
}

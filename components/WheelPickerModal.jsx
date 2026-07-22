import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "../theme";
import { PrimaryBtn } from "./UI";

const haptic = () => { try { navigator.vibrate?.(6); } catch {} };
const PX = 14; // px per unit — ruler density

// ── WheelPicker — a real horizontal ruler, iOS-style: the ruler scrolls,
// a single fixed accent indicator (line + triangle) never moves. Replaces
// the earlier vertical wheel-with-highlighted-row design entirely.
//
// Props: open, title, unit, value, onChange (fires with the final number
// when Done is pressed), onClose, plus either `items` (explicit numeric
// list) or min/max/step to derive one.
export default function WheelPicker({ open, title, unit, items, min, max, step = 1, value, onChange, onClose }) {
  const C = useTheme();
  const dark = C.name === "dark";
  const values = useMemo(() => {
    if (items) return items;
    const arr = [];
    for (let v = min; v <= max; v += step) arr.push(Math.round(v / step) * step);
    return arr;
  }, [items, min, max, step]);
  const idxOf = useCallback((v) => Math.max(0, Math.min(values.length - 1, values.indexOf(v))), [values]);

  const trackRef = useRef(null);
  const settleTimer = useRef(null);
  const lastHaptic = useRef(value);
  const drag = useRef(null); // mouse-drag (touch keeps native momentum + snap)
  const [temp, setTemp] = useState(value); // live draft — Done commits it
  const [closing, setClosing] = useState(false);

  const scrollToValue = useCallback((v, smooth = true) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: idxOf(v) * PX, behavior: smooth ? "smooth" : "auto" });
  }, [idxOf]);

  // Reset the draft and jump the ruler to the current value every time the
  // sheet opens — no leftover scroll position from a previous open.
  useEffect(() => {
    if (!open) return;
    setTemp(value);
    setClosing(false);
    lastHaptic.current = value;
    const id = requestAnimationFrame(() => scrollToValue(value, false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollLeft / PX)));
    const v = values[i];
    if (v !== temp) setTemp(v); // live update while scrolling
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      scrollToValue(v);
      if (v !== lastHaptic.current) { haptic(); lastHaptic.current = v; }
    }, 80);
  };

  const requestClose = () => {
    // Slide the sheet down, THEN unmount — a bare `if (!open) return null`
    // would cut the close straight to nothing with no exit motion.
    setClosing(true);
    setTimeout(onClose, 260);
  };
  const confirm = () => { onChange(temp); requestClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const track = dark ? "rgba(255,255,255,0.22)" : "rgba(16,24,40,0.16)";
  const trackMajor = dark ? "rgba(255,255,255,0.5)" : "rgba(16,24,40,0.38)";

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.4)",
        animation: "athlosFade 0.2s ease",
      }}
    >
      <style>{`
        .ath-ruler::-webkit-scrollbar { display: none; }
        @keyframes athWpSlideUp   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes athWpSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
      `}</style>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: C.surface, borderRadius: "30px 30px 0 0",
          boxShadow: dark ? "0 -20px 50px rgba(0,0,0,0.5)" : "0 -20px 50px rgba(16,24,40,0.18)",
          padding: "26px 22px max(28px, env(safe-area-inset-bottom, 28px))",
          animation: `${closing ? "athWpSlideDown" : "athWpSlideUp"} 0.28s cubic-bezier(0.22,1,0.36,1) both`,
        }}
      >
        <div style={{ fontFamily: C.display, fontWeight: 500, fontSize: 14.5, color: C.muted, textAlign: "center" }}>
          {title}
        </div>

        {/* Selected value — large, live, centered */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5, margin: "16px 0 26px" }}>
          <span style={{ fontFamily: C.heading, fontWeight: 800, fontSize: 52, color: C.text, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {temp}
          </span>
          <span style={{ fontFamily: C.display, fontWeight: 600, fontSize: 18, color: C.muted }}>{unit}</span>
        </div>

        {/* Ruler — the track scrolls; the indicator below never moves */}
        <div style={{ position: "relative", height: 76 }}>
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="ath-ruler"
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse") return;
              drag.current = { x: e.clientX, left: trackRef.current.scrollLeft };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse" || !drag.current) return;
              trackRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            style={{
              position: "absolute", inset: 0, overflowX: "scroll", overflowY: "hidden",
              WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory",
              scrollbarWidth: "none", msOverflowStyle: "none", cursor: "grab",
              // half-tick inset so a snapped tick i lands at scrollLeft = i*PX
              // exactly (a plain 50% pad snaps to i*PX + PX/2, which read back
              // as i+1 — an off-by-one between the centered tick and the value)
              display: "flex", alignItems: "flex-start", padding: `0 calc(50% - ${PX / 2}px)`,
            }}
          >
            {values.map((v) => {
              const major = v % 5 === 0;
              return (
                <div key={v} aria-hidden="true" style={{ flex: `0 0 ${PX}px`, display: "flex", flexDirection: "column", alignItems: "center", scrollSnapAlign: "center" }}>
                  <div style={{ width: major ? 2 : 1.3, height: major ? 38 : 20, borderRadius: 1, background: major ? trackMajor : track }} />
                  {major && <span style={{ marginTop: 8, fontFamily: C.display, fontWeight: 600, fontSize: 11, color: C.muted2 }}>{v}</span>}
                </div>
              );
            })}
          </div>

          {/* fixed center indicator — thin accent line + downward triangle,
              purely decorative, sits above the track and never scrolls */}
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: 0, height: 40, width: 2.5, transform: "translateX(-50%)", background: C.accent, borderRadius: 2, pointerEvents: "none", boxShadow: `0 0 6px ${C.accent}55` }} />
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: 40, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `8px solid ${C.accent}`, pointerEvents: "none" }} />
        </div>

        <div style={{ marginTop: 30 }}>
          <PrimaryBtn onClick={confirm}>Done</PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

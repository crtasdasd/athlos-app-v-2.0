import React, { useRef } from "react";

// ── Ruler slider — horizontal track with a value bubble riding the thumb and
// a numbered tick ruler underneath. Used by onboarding (height/weight) and
// the ZEUS funnel (session length). ──
export default function RulerSlider({ label, min, max, value, onChange, C, step = 1, format }) {
  const trackRef = useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const snap = (v) => clamp(Math.round(v / step) * step);
  const toVal = (clientX) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return value;
    return snap(min + ((clientX - r.left) / r.width) * (max - min));
  };
  const pct = ((clamp(value) - min) / (max - min)) * 100;
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round(min + (i * (max - min)) / 5));
  const dark = C.name === "dark";
  const fmt = format || ((v) => v);
  return (
    <div style={{ marginBottom: 19 }}>
      {label && <div style={{ fontFamily: C.display, fontWeight: 600, fontSize: 13, color: C.text2, marginBottom: 26 }}>{label}</div>}
      {!label && <div style={{ height: 40 }} />}
      <div
        ref={trackRef}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onChange(toVal(e.clientX)); }}
        onPointerMove={(e) => { if (e.buttons > 0) onChange(toVal(e.clientX)); }}
        style={{ position: "relative", height: 26, cursor: "pointer", touchAction: "none" }}
      >
        {/* rail + filled part */}
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, height: 2, borderRadius: 999, background: dark ? "rgba(255,255,255,0.16)" : "rgba(28,24,20,0.14)" }} />
        <div style={{ position: "absolute", top: 11.5, left: 0, width: `${pct}%`, height: 3, borderRadius: 999, background: C.text }} />
        {/* value bubble above the thumb */}
        <div style={{ position: "absolute", top: -36, left: `${pct}%`, transform: "translateX(-50%)", background: C.btn, color: C.btnText, borderRadius: 9, padding: "4px 8px", fontFamily: C.mono, fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          {fmt(clamp(value))}
          <span aria-hidden="true" style={{ position: "absolute", left: "50%", bottom: -3, width: 8, height: 8, background: C.btn, transform: "translateX(-50%) rotate(45deg)" }} />
        </div>
        {/* thumb */}
        <div style={{ position: "absolute", top: 5, left: `${pct}%`, transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: C.btn, border: `2.5px solid ${C.bg}`, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }} />
      </div>
      {/* tick ruler */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        {ticks.map((v) => (
          <div key={v} style={{ textAlign: "center" }}>
            <div style={{ width: 1, height: 7, background: dark ? "rgba(255,255,255,0.25)" : "rgba(28,24,20,0.25)", margin: "0 auto 4px" }} />
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.muted2 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

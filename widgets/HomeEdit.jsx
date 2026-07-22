import React, { useRef, useState } from "react";
import { Mono, PrimaryBtn } from "../../components/UI";
import { IcFlame, IcGauge, IcBandage, IcChat, IcDumbbell, IcTrendUp, IcBall, IcMeal, IcMoon, IcDrop } from "../../components/Icons";

// Per spec (ATHLOS-dodatki-spec.pdf, §06 · Custom home):
// The athlete picks which widgets the home screen shows and in what order.
// An "Edit" button opens this sheet: every widget has an on/off toggle and a
// drag handle (⋮⋮) for pointer-based reordering. Readiness + today's AI
// program are locked (always shown). The layout persists locally.
export const HOME_WIDGETS = {
  checkin:     { icon: <IcFlame size={16} />, label: "Streak (wellness check-in)" },
  readiness:   { icon: <IcGauge size={16} />, label: "Readiness baterija", locked: true },
  injury:      { icon: <IcBandage size={16} />, label: "Poškodbe" },
  reflections: { icon: <IcChat size={16} />, label: "Refleksije" },
  workout:     { icon: <IcDumbbell size={16} />, label: "AI program danes", locked: true },
  report:      { icon: <IcTrendUp size={16} />, label: "Včerajšnje poročilo" },
  match:       { icon: <IcBall size={16} />, label: "Naslednja tekma" },
  meal:        { icon: <IcMeal size={16} />, label: "Naslednji obrok" },
  sleep:       { icon: <IcMoon size={16} />, label: "Spanje (zadnjih 7 dni)" },
  hydration:   { icon: <IcDrop size={16} />, label: "Hidracija" },
};

// Mock order: medallion → today's trial, everything else below the fold.
const DEFAULT_LAYOUT = [
  { id: "readiness", on: true },
  { id: "workout", on: true },
  { id: "checkin", on: true },
  { id: "injury", on: true },
  { id: "reflections", on: true },
  { id: "report", on: true },
  { id: "match", on: true },
  { id: "meal", on: true },
  { id: "sleep", on: false },
  { id: "hydration", on: false },
];

// v2: bumped so layouts saved before the mock-exact pass don't override the new default order
const LAYOUT_KEY = "athlos:homeLayout.v2";

export function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    if (!Array.isArray(saved)) return DEFAULT_LAYOUT;
    // keep saved order/toggles, append widgets added since it was saved
    const known = new Set(saved.map((w) => w.id));
    const merged = [...saved.filter((w) => HOME_WIDGETS[w.id]), ...DEFAULT_LAYOUT.filter((w) => !known.has(w.id))];
    return merged.map((w) => (HOME_WIDGETS[w.id]?.locked ? { ...w, on: true } : w));
  } catch { return DEFAULT_LAYOUT; }
}

export function saveLayout(layout) {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
}

const ROW_H = 58; // row height + gap, used to map drag distance → index

export function EditHomeSheet({ layout, onSave, onClose, C, t }) {
  const [items, setItems] = useState(layout);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);

  const onDown = (idx) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startY.current = e.clientY;
    setDragIdx(idx);
    setDragY(0);
  };
  const onMove = (e) => {
    if (dragIdx === null) return;
    const dy = e.clientY - startY.current;
    const target = Math.max(0, Math.min(items.length - 1, dragIdx + Math.round(dy / ROW_H)));
    if (target !== dragIdx) {
      setItems((arr) => {
        const next = [...arr];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(target, 0, moved);
        return next;
      });
      startY.current += (target - dragIdx) * ROW_H;
      setDragIdx(target);
      setDragY(e.clientY - startY.current);
    } else {
      setDragY(dy);
    }
  };
  const onUp = () => { setDragIdx(null); setDragY(0); };

  const toggle = (id) => setItems((arr) => arr.map((w) => (w.id === id && !HOME_WIDGETS[id]?.locked ? { ...w, on: !w.on } : w)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: C.bg, display: "flex", flexDirection: "column", animation: "athlosFade 0.2s ease" }}>
      {/* header */}
      <div style={{ padding: "11px 13px 10px", display: "flex", alignItems: "center", gap: 9, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>×</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 16, color: C.text, margin: 0 }}>{t("Uredi home screen")}</h2>
          <Mono style={{ color: C.muted, fontSize: 8.5, letterSpacing: "0.1em" }}>EDIT · ON</Mono>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "11px 13px 16px" }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <p style={{ fontFamily: C.display, fontSize: 14, color: C.text2, margin: "0 0 11px", lineHeight: 1.5 }}>
          {t("Izberi widgete, ki jih želiš imeti na home screenu. Vlečenje za vrstni red.")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((w, idx) => {
            const meta = HOME_WIDGETS[w.id];
            if (!meta) return null;
            const dragging = idx === dragIdx;
            return (
              <div key={w.id} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", height: 50, boxSizing: "border-box",
                background: C.surface, border: `1px solid ${dragging ? C.accent : C.border}`, borderRadius: 12,
                transform: dragging ? `translateY(${dragY}px) scale(1.02)` : "none",
                boxShadow: dragging ? "0 10px 26px rgba(0,0,0,0.18)" : "none",
                transition: dragging ? "none" : "transform 0.15s ease",
                position: "relative", zIndex: dragging ? 2 : 1,
                opacity: w.on || meta.locked ? 1 : 0.55,
              }}>
                {/* drag handle */}
                <span
                  onPointerDown={onDown(idx)}
                  style={{ cursor: "grab", touchAction: "none", color: C.muted, fontSize: 15, letterSpacing: "-2px", padding: "4px 2px", userSelect: "none" }}
                >⋮⋮</span>
                <span style={{ display: "flex", color: C.gold }}>{meta.icon}</span>
                <span style={{ flex: 1, fontFamily: C.display, fontWeight: 600, fontSize: 14, color: C.text }}>
                  {t(meta.label)}
                  {meta.locked && <Mono style={{ color: C.muted2, fontSize: 8.5, marginLeft: 8 }}>{t("VEDNO PRIKAZAN")}</Mono>}
                </span>
                {/* toggle */}
                <button onClick={() => toggle(w.id)} disabled={meta.locked} aria-label={meta.label} style={{
                  width: 42, height: 24, borderRadius: 999, border: "none", cursor: meta.locked ? "default" : "pointer",
                  background: w.on || meta.locked ? C.accent : C.surface3, position: "relative",
                  opacity: meta.locked ? 0.5 : 1, transition: "background 0.2s", WebkitTapHighlightColor: "transparent", flexShrink: 0,
                }}>
                  <span style={{
                    position: "absolute", top: 3, left: w.on || meta.locked ? 21 : 3, width: 18, height: 18, borderRadius: "50%",
                    background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s",
                  }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "9px 13px", paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <PrimaryBtn onClick={() => onSave(items)}>{t("Shrani postavitev")}</PrimaryBtn>
      </div>
    </div>
  );
}

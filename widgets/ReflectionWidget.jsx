import React, { useRef, useState } from "react";
import { Mono } from "../../components/UI";

// Per spec (ATHLOS-dodatki-spec.pdf, §03 · Refleksija):
// A small stack of personalized AI insight cards below the readiness card.
// Swipe a card away to dismiss it permanently; the next one in the stack
// shows through. Renders nothing once the stack is empty.
//
// Persistence (spec "sistemski hook"): dismissals survive reload, every
// insight expires 48 h after it was first shown, and an id is never shown
// again once dismissed (dedup).
const STORE_KEY = "athlos:reflections";
const TTL_MS = 48 * 3600 * 1000;

const loadStore = () => {
  try { return { dismissed: {}, firstSeen: {}, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; }
  catch { return { dismissed: {}, firstSeen: {} }; }
};
const saveStore = (s) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} };

// Stamp unseen ids and prune entries whose insight no longer exists so the
// store doesn't grow forever.
function syncStore(insights) {
  const s = loadStore();
  const now = Date.now();
  const ids = new Set(insights.map((i) => i.id));
  let changed = false;
  for (const i of insights) {
    if (!s.firstSeen[i.id]) { s.firstSeen[i.id] = now; changed = true; }
  }
  for (const id of Object.keys(s.firstSeen)) {
    if (!ids.has(id) && !s.dismissed[id]) { delete s.firstSeen[id]; changed = true; }
  }
  if (changed) saveStore(s);
  return s;
}

export default function ReflectionWidget({ insights, C, t }) {
  const [store] = useState(() => syncStore(insights));
  const [dismissed, setDismissed] = useState(() => Object.keys(store.dismissed));
  const dragX = useRef(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  const now = Date.now();
  const queue = insights.filter(
    (i) => !dismissed.includes(i.id) && now - (store.firstSeen[i.id] || now) < TTL_MS
  );
  if (queue.length === 0) return null;

  const top = queue[0];
  const behindCount = queue.length - 1;
  const iconColor = { gold: C.gold, accent: C.accent, red: C.red }[top.color] || C.gold;

  const onStart = (x) => { dragging.current = true; startX.current = x; };
  const onMove = (x) => { if (!dragging.current) return; dragX.current = x - startX.current; setDrag(dragX.current); };
  const onEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (Math.abs(dragX.current) > 90) {
      setDismissed((d) => [...d, top.id]);
      const s = loadStore();
      s.dismissed[top.id] = Date.now();
      saveStore(s);
    }
    dragX.current = 0;
    setDrag(0);
  };

  return (
    <div style={{ position: "relative", marginBottom: 10, minHeight: 132 }}>
      {/* preview of the card(s) behind, peeking out */}
      {behindCount > 0 && (
        <div style={{
          position: "absolute", inset: "6px 6px -6px 6px", borderRadius: 16,
          background: C.surface3, border: `1px solid ${C.border}`, opacity: 0.6,
        }} />
      )}
      <div
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        style={{
          position: "relative", background: C.surface2, borderRadius: 18, padding: 18,
          boxShadow: C.name === "dark" ? "0 1px 2px rgba(0,0,0,0.35)" : "0 2px 10px rgba(16,24,40,0.05)",
          transform: `translateX(${drag}px) rotate(${drag * 0.04}deg)`,
          opacity: 1 - Math.min(Math.abs(drag) / 220, 0.6),
          transition: dragging.current ? "none" : "transform 0.25s ease, opacity 0.25s ease",
          cursor: "grab", touchAction: "pan-y",
        }}
      >
        {/* tinted icon tile + coloured kicker — the reference's insights row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${iconColor}16`, border: `1px solid ${iconColor}2e`, color: iconColor,
          }}>{top.icon}</span>
          <Mono style={{ color: iconColor, fontSize: 9, letterSpacing: "0.12em" }}>{t(top.kicker)}</Mono>
        </div>
        <p style={{ fontFamily: C.display, fontSize: 14, color: C.text, lineHeight: 1.5, margin: 0 }}>{t(top.text)}</p>
        <Mono style={{ color: C.muted2, fontSize: 9, marginTop: 9, display: "block" }}>
          ← {t("povleci za naslednje")} · {queue.length} {t("sporočil")}
        </Mono>
      </div>
    </div>
  );
}

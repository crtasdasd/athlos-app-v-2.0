import React, { useRef, useEffect, useCallback } from "react";

// iOS-style vertical spinner column — native momentum scroll + CSS scroll-snap
// gives the real "sliding" feel; the centered item is highlighted, others fade
// toward the edges. Used by the date-of-birth picker and the height/weight step.
const ITEM_H = 40;
const PAD = 2; // default rows above/below center → 5-row visible window

export default function WheelColumn({ items, value, onChange, render, width = 64, C, align = "center", showBand = true, activeColor, pad = PAD }) {
  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const ref = useRef(null);
  const settleTimer = useRef(null);
  const drag = useRef(null); // mouse-drag scrolling (touch keeps native momentum)
  const idx = Math.max(0, items.indexOf(value));

  const scrollToIdx = useCallback((i, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: i * ITEM_H, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToIdx(idx, false); }, []); // snap to initial value on mount, no animation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToIdx(idx); }, [value]); // follow external/controlled changes (e.g. day clamped by month)

  const onScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      scrollToIdx(clamped);
      if (items[clamped] !== value) onChange(items[clamped]);
    }, 90);
  };

  const visibleH = ITEM_H * (pad * 2 + 1);

  return (
    <div style={{ position: "relative", height: visibleH, width, flexShrink: 0 }}>
      {/* center selection band — engraved bronze rules (hidden when a parent
          draws its own full-width highlight bar instead) */}
      {showBand && <div style={{
        position: "absolute", top: ITEM_H * pad, left: 0, right: 0, height: ITEM_H,
        borderTop: `1px solid ${C.gold}77`, borderBottom: `1px solid ${C.gold}77`,
        pointerEvents: "none", zIndex: 2,
      }} />}
      <div
        ref={ref}
        onScroll={onScroll}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { y: e.clientY, top: ref.current.scrollTop, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse" || !drag.current) return;
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dy) > 3) drag.current.moved = true;
          ref.current.scrollTop = drag.current.top - dy;
        }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onPointerCancel={() => { drag.current = null; }}
        className="athlos-wheel-scroll"
        style={{
          height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none",
          cursor: "grab",
          // fade the rows themselves toward the edges (a mask, not painted
          // overlays — so any backdrop shows through, no solid box)
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0, #000 ${ITEM_H * pad}px, #000 calc(100% - ${ITEM_H * pad}px), transparent 100%)`,
          maskImage: `linear-gradient(to bottom, transparent 0, #000 ${ITEM_H * pad}px, #000 calc(100% - ${ITEM_H * pad}px), transparent 100%)`,
        }}
      >
        <style>{`.athlos-wheel-scroll::-webkit-scrollbar{display:none}`}</style>
        <div style={{ height: ITEM_H * pad }} />
        {items.map((it, i) => {
          const active = it === value;
          return (
            <div
              key={i}
              onClick={() => { if (drag.current?.moved) return; scrollToIdx(i); onChange(it); }}
              style={{
                height: ITEM_H, scrollSnapAlign: "center",
                display: "flex", alignItems: "center", justifyContent: justify,
                fontFamily: C.heading, fontWeight: active ? 800 : 400,
                fontSize: active ? 21.5 : 17,
                color: active ? (activeColor || C.text) : C.muted,
                opacity: active ? 1 : 0.5,
                transition: "font-size 0.15s, color 0.15s, opacity 0.15s, font-weight 0.15s",
                cursor: "pointer", userSelect: "none", WebkitUserSelect: "none",
              }}
            >
              {render ? render(it) : it}
            </div>
          );
        })}
        <div style={{ height: ITEM_H * pad }} />
      </div>
    </div>
  );
}

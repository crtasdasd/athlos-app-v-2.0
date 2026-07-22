import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../theme";
import { Mono } from "./UI";
import { useT } from "../lib/i18n";

const ITEM_H = 52;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

function Drum({ items, value, onChange, label }) {
  const C = useTheme();
  const ref = useRef(null);
  const scrollTimer = useRef(null);
  const drag = useRef(null); // mouse-drag scrolling (touch keeps native momentum)
  const idx = items.indexOf(value);

  const scrollTo = (i, smooth = true) => {
    if (!ref.current) return;
    ref.current.scrollTo({ top: i * ITEM_H, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => { scrollTo(idx, false); }, []); // eslint-disable-line
  useEffect(() => { scrollTo(idx); }, [value]); // eslint-disable-line

  // After scroll stops, snap and update
  const onScroll = () => {
    if (!ref.current) return;
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!ref.current) return;
      const i = Math.round(ref.current.scrollTop / ITEM_H);
      const c = Math.max(0, Math.min(items.length - 1, i));
      onChange(items[c]);
      scrollTo(c);
    }, 100);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <Mono style={{ color: C.muted, fontSize: 8.5, marginBottom: 6 }}>{label}</Mono>
      <div style={{ position: "relative", height: ITEM_H * VISIBLE, width: "100%", overflow: "hidden", borderRadius: 14 }}>
        {/* Fade top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * PAD, background: `linear-gradient(to bottom, ${C.bg} 40%, transparent)`, zIndex: 2, pointerEvents: "none" }} />
        {/* Fade bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * PAD, background: `linear-gradient(to top, ${C.bg} 40%, transparent)`, zIndex: 2, pointerEvents: "none" }} />
        {/* Selection highlight — engraved bronze band */}
        <div style={{
          position: "absolute", top: "50%", left: 8, right: 8,
          height: ITEM_H, transform: "translateY(-50%)",
          background: `${C.gold}10`, border: `1.5px solid ${C.gold}55`,
          borderRadius: 12, zIndex: 1, pointerEvents: "none",
        }} />

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
          style={{
            height: "100%", overflowY: "scroll",
            scrollSnapType: "y mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            paddingTop: ITEM_H * PAD,
            paddingBottom: ITEM_H * PAD,
            cursor: "grab",
          }}
        >
          {items.map((v) => {
            const active = v === value;
            return (
              <div
                key={v}
                onPointerDown={(e) => { e.currentTarget._tapY = e.clientY; }}
                onPointerUp={(e) => {
                  const moved = Math.abs(e.clientY - (e.currentTarget._tapY || e.clientY));
                  if (moved < 8) {
                    onChange(v);
                    scrollTo(items.indexOf(v));
                  }
                }}
                style={{
                  height: ITEM_H, scrollSnapAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: C.display,
                  fontWeight: active ? 800 : 400,
                  fontSize: active ? 33.5 : 24.5,
                  color: active ? C.text : C.muted,
                  letterSpacing: "-0.03em",
                  transition: "font-size 0.15s, color 0.15s, font-weight 0.15s",
                  cursor: "pointer",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  position: "relative", zIndex: 3,
                  touchAction: "pan-y",
                }}
              >
                {v}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimePicker({ value, onChange, onClose }) {
  const C = useTheme();
  const t = useT();
  const [hh, mm] = (value || "12:00").split(":");
  const [hour, setHour] = useState(hh || "12");
  const [min,  setMin]  = useState(mm || "00");

  const confirm = () => { onChange(`${hour}:${min}`); onClose(); };

  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <style>{`@keyframes dpUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", zIndex: 1, background: C.bg, borderRadius: "26px 26px 0 0", border: `1px solid ${C.border2}`, borderBottom: "none", overflow: "hidden", animation: "dpUp 0.3s cubic-bezier(.2,.8,.2,1)" }}
      >
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "9px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: C.border2 }} />
        </div>

        {/* Header */}
        <div style={{ padding: "4px 14px 9px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <Mono style={{ color: C.gold, fontSize: 8.5, letterSpacing: "0.22em" }}>{t("IZBRANA URA")}</Mono>
            <div style={{ fontFamily: C.heading, fontWeight: 700, fontSize: 22, color: C.text, marginTop: 4 }}>
              {hour}<span style={{ color: C.muted, margin: "0 2px" }}>:</span>{min}
            </div>
          </div>
          <Mono style={{ color: C.muted, fontSize: 9 }}>24H</Mono>
        </div>

        {/* Drums */}
        <div style={{ display: "flex", padding: "6px 11px 4px", gap: 6, position: "relative" }}>
          {/* Center divider line */}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontFamily: C.display, fontWeight: 800, fontSize: 29, color: C.muted, pointerEvents: "none", zIndex: 10, marginTop: 13 }}>:</div>
          <Drum items={HOURS}   value={hour} onChange={setHour} label={t("URE")} />
          <Drum items={MINUTES} value={min}  onChange={setMin}  label={t("MINUTE")} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, padding: "9px 11px 18px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.text, fontFamily: C.display, fontWeight: 700, fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            {t("Prekliči")}
          </button>
          <button onClick={confirm} style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: C.btn, color: C.btnText, fontFamily: C.heading, fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            {t("Potrdi")}
          </button>
        </div>
      </div>
    </div>
  );
}

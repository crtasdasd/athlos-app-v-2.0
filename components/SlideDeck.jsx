import React, { useState, useRef, useCallback } from "react";
import { useTheme } from "../theme";

// This deck is a full-bleed photographic takeover, so its palette is fixed to
// the dark treatment in BOTH themes — light-theme tokens would put dark text
// on a dark photograph. GREEN is the brand's electric accent (theme.js dark
// accent), the one colour that reads cleanly against the scrimmed image.
const GREEN = "#00FF87";
const INK = "#080808";

// Wraps one word of the headline in the app's signature italic-green emphasis.
// Written inline rather than reusing <Accent> because that component is
// theme-coupled (light theme's deep emerald would disappear over the photo).
function renderTitle(title, accentWord) {
  if (!accentWord) return title;
  const idx = title.indexOf(accentWord);
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <span style={{ color: GREEN, fontStyle: "italic" }}>{accentWord}</span>
      {title.slice(idx + accentWord.length)}
    </>
  );
}

// ── SlideDeck — full-screen swipeable deck. The photograph behind the copy is
// one still stage that never moves: only the captions travel across it, so the
// slides read as text moving over a single scene rather than as separate cards.
// Copy sits low and left; the eyebrow names the real destination in the app, so
// the structure carries information instead of decorating.
export default function SlideDeck({ slides, onDone, backdrop, skipLabel = "Skip", doneLabel = "Let's go" }) {
  const C = useTheme();
  const [i, setI] = useState(0);
  const last = i === slides.length - 1;
  const trackRef = useRef(null);
  const settleTimer = useRef(null);
  const drag = useRef(null);

  const scrollToIdx = useCallback((idx, smooth = true) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const w = el.clientWidth || 1;
      const idx = Math.max(0, Math.min(slides.length - 1, Math.round(el.scrollLeft / w)));
      setI((cur) => (cur === idx ? cur : idx));
    }, 90);
  };

  const goTo = (idx) => {
    setI(idx);
    scrollToIdx(idx);
  };

  const goNext = () => {
    if (last) { onDone?.(); return; }
    goTo(i + 1);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: INK, overflow: "hidden" }}>
      <style>{`.athlos-slidedeck-track::-webkit-scrollbar { display: none; }`}</style>

      {/* The stage — one photograph under the whole deck, scrimmed to near-solid
          where the copy sits so the type never fights the image. Deliberately
          static: it carries no transform, so `cover` frames it edge to edge and
          nothing can drift the image off its own stage. */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(180deg, rgba(8,8,8,0.42) 0%, rgba(8,8,8,0.68) 36%, ${INK} 76%), url('${backdrop}')`,
        backgroundSize: "cover", backgroundPosition: "center 20%",
      }} />

      <div style={{
        position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
        paddingTop: "calc(env(safe-area-inset-top, 20px) + 12px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
      }}>
        <button
          onClick={onDone}
          style={{
            alignSelf: "flex-end", marginRight: 20, background: "none", border: "none",
            color: "rgba(255,255,255,0.55)", fontFamily: C.display, fontSize: 13, fontWeight: 600,
            cursor: "pointer", padding: 8, WebkitTapHighlightColor: "transparent",
          }}
        >
          {skipLabel}
        </button>

        <div
          ref={trackRef}
          onScroll={onScroll}
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse") return;
            drag.current = { x: e.clientX, left: trackRef.current.scrollLeft };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse" || !drag.current) return;
            trackRef.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
          }}
          onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
          onPointerCancel={() => { drag.current = null; }}
          className="athlos-slidedeck-track"
          style={{
            flex: 1, minHeight: 0, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch", scrollbarWidth: "none", cursor: "grab",
          }}
        >
          {slides.map((s, idx) => (
            <div key={idx} style={{
              flex: "0 0 100%", width: "100%", scrollSnapAlign: "center",
              display: "flex", flexDirection: "column", justifyContent: "flex-end",
              padding: "0 26px 6px",
            }}>
              <span style={{
                fontFamily: C.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.24em",
                textTransform: "uppercase", color: GREEN,
              }}>
                {s.eyebrow}
              </span>
              <h1 style={{
                fontFamily: C.display, fontWeight: 800,
                fontSize: "clamp(31px, 9.8vw, 43px)", lineHeight: 1.03, letterSpacing: "-0.035em",
                color: "#FFFFFF", margin: "14px 0 0",
              }}>
                {renderTitle(s.title, s.accentWord)}
              </h1>
              <p style={{
                fontFamily: C.display, fontWeight: 400, fontSize: 14.5, lineHeight: 1.6,
                color: "rgba(255,255,255,0.68)", margin: "15px 0 0", maxWidth: 340,
              }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Progress rail + action on one row — the current segment widens, the
            same indicator language the setup flow already uses at its bottom.
            Each segment is also a jump target: the 3px line is the mark, but the
            button around it is 24px tall so there is a real thumb-sized hit
            area, since a 3px tap target is unusable on touch. */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "24px 26px 0" }}>
          <div style={{ flex: 1, display: "flex", gap: 5, minWidth: 0 }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                aria-label={`${idx + 1} / ${slides.length}`}
                aria-current={idx === i ? "true" : undefined}
                style={{
                  flex: idx === i ? 2.2 : 1, minWidth: 0, height: 24, padding: 0,
                  border: "none", background: "none", cursor: "pointer",
                  display: "flex", alignItems: "center",
                  transition: "flex 0.4s cubic-bezier(0.22,1,0.36,1)",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span aria-hidden="true" style={{
                  width: "100%", height: 3, borderRadius: 999,
                  background: idx <= i ? GREEN : "rgba(255,255,255,0.18)",
                  transition: "background 0.3s ease",
                }} />
              </button>
            ))}
          </div>
          <button
            onClick={goNext}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
              background: GREEN, color: INK, border: "none", borderRadius: 999,
              padding: "13px 22px", fontFamily: C.display, fontWeight: 700, fontSize: 14,
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
            }}
          >
            {last ? doneLabel : "Next"}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
